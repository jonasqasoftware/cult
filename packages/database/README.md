# @cult/database

Drizzle/PostgreSQL adapter for CULT's domain ports (`CanonicalEventRepositoryPort`,
`RawEventRepositoryPort`, `SourceRegistryPort`), plus the M7 Discovery query layer used
by `apps/api`.

## Discovery (M7)

`discoverEvents(db, query)` (`src/discovery/discover-events.ts`) is the query service
behind `GET /v1/events`. It is intentionally a separate module from
`CanonicalEventRepositoryPort` — discovery is a read/query-layer concern (filtering,
ranking, pagination across many events), not a domain repository operation
(save/find-one).

```ts
interface DiscoveryQuery {
  q?: string;
  dateRange?: { start: string; end: string }; // already resolved, e.g. by resolveDateRangeFilter
  category?: string;
  free?: boolean;
  status?: EventStatus; // defaults to "scheduled" if omitted
  geo?: { lat: number; lng: number; radiusMeters: number };
  cursor?: string;
  limit: number;
}
```

`discoverEvents` does no validation of raw input — every field is assumed already
well-formed (a real calendar-date range, in-bounds lat/lng/radius, an already-decoded
cursor shape). `apps/api/src/discovery-query.ts` is what turns raw, possibly-invalid
query-string values into this shape, mapping failures to RFC 9457 Problem Details. This
split keeps SQL out of the Fastify route and HTTP/validation concerns out of the query
service.

### Temporal filtering

`src/discovery/period.ts` resolves `today`/`tomorrow`/`weekend`/`this_week`/
`this_month` into a `{ start, end }` calendar-date range in **America/Sao_Paulo** — pure
functions, unit-tested with an injected clock, never `Date.now()`. `this_week` is
Monday-Sunday; `weekend` is the Saturday+Sunday of the current week (if today is already
Saturday or Sunday, that's the weekend returned).

`discoverEvents` matches an event against a date range if **any** of its occurrences
overlaps it — not just the first — using the same "local calendar date" reasoning as the
deduplication engine's temporal signal: a timed occurrence's relevant date is its start
(and end, if any) converted to the local date in America/Sao_Paulo; a date-only
occurrence's relevant range is its `start_date`/`end_date` as-is (ADR-0014: `kind=date`
never means "all day," only "no time precision reported").

### Search (`q`)

Uses pg_trgm (already-approved infra — ADR-0005), not a new dependency: a plain
case-insensitive `ILIKE '%term%'` for substring matches, OR'd with pg_trgm's
`word_similarity()` for typo/accent tolerance. `word_similarity`, not `similarity` — the
latter compares whole strings, which dilutes to near-zero once a title/venue name has
several other words; `word_similarity` finds the best-matching word-length substring
first. Searches title, description, venue name, and performer names (as serialized
JSON — no dedicated performer table exists yet).

### Nearby (`lat`/`lng`/`radius`)

Uses PostGIS `ST_DWithin` against `venues.location`, a **generated** `geography(Point,
4326)` column (migration `0002_discovery_indexes.sql`) derived from
`latitude`/`longitude` — `STORED` and computed by Postgres itself, so it can never drift
out of sync with them (there is no application-side write path to keep it in sync). An
event with no venue coordinates has `location IS NULL` and therefore never matches a
nearby search, with no special-casing required anywhere else. Distance is reported in
**meters** via `ST_Distance`.

### Ordering and pagination

Default ordering is by each event's soonest relevant occurrence ("próxima ocorrência"),
then event id as a tie-breaker; a nearby query orders by distance first, then soonest
occurrence. Pagination is a keyset ("no offset") cursor (`src/discovery/cursor.ts`) —
opaque, base64url-encoded JSON carrying exactly the ordering columns needed to resume
(`{sortInstant, id}`, or `{distanceMeters, sortInstant, id}` for nearby), with a `mode`
tag so a cursor built for one ordering is rejected (not silently misapplied) if the
query's mode has since changed.

### Avoiding N+1

`discoverEvents` runs one ranking query to find the matching/ordered page of event ids,
then `loadCanonicalEventsByIds` (`src/load-canonical-events-by-ids.ts`) loads full
`CanonicalEvent` data for that page in a **fixed 4 queries total** (events, venues,
occurrences, sources — each a single `WHERE id IN (...)`), regardless of page size —
never one query per event.

### Schema gaps not expressible via Drizzle's schema.ts

`venues.location` (the generated geography column above) and several indexes —
`events.status`, GIN trigram indexes on `events.title`/`venues.name`, btree indexes on
`event_occurrences.starts_at` and `(start_date, end_date)`, and the GIST index on
`venues.location` — are all hand-written SQL in migration `0002_discovery_indexes.sql`
rather than declared in `src/schema.ts`. Drizzle's pg-core schema builder in this
version has no first-class way to express a PostGIS-generated column or a trigram
opclass index. This means a future `pnpm db:generate` diffing against `schema.ts` won't
know these exist — that drift is intentional and documented here, not accidental.

## Limitations

- No dedicated categories/performers/organizers tables — categories are a free-text
  `category_id`, performers/organizer are inline JSON on `events`.
- Cross-source duplicates are not merged (the M6/M6.1 deduplication engine exists but is
  not wired into ingestion or discovery yet) — a search or listing can show two distinct
  `CanonicalEvent`s that a human would recognize as the same real-world event.
