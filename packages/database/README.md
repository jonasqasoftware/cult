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

## Dedup persistence + presentation suppression (M9)

`src/dedup/` connects the M6/M6.1 deduplication engine to the product — reversibly. It
never physically merges two `CanonicalEvent`s: no field reconciliation, no deletion, no
destructive provenance move. It only decides which of a same-event pair to *show*.

- **`find-candidate-pairs.ts`** — SQL blocking, recall-oriented (section 8: more
  permissive than any final-matching threshold, since missing a real duplicate here means
  the engine never even sees it). Cross-source only (`NOT EXISTS` a shared `source_id`
  between the two events), a permissive `pg_trgm` title check
  (`GREATEST(similarity, word_similarity) > 0.15`), and any-occurrence temporal overlap
  using the same local-date-range technique as Discovery. It never decides identity —
  that's the engine's job, reused exactly as-is from `@cult/deduplication`, never
  reimplemented in SQL (section 9).
- **`pair.ts`** — `normalizePair(a, b)`: A+B and B+A always normalize to the same
  `{leftEventId, rightEventId}` (the smaller id first), enforced additionally by a DB
  CHECK constraint (`left_event_id < right_event_id`) so the unique index on the pair can
  never be bypassed by storing both orderings.
- **`candidate-repository.ts`** — `upsertEngineEvaluation` is the engine's only write
  path into `dedup_candidates` (migration `0003_dedup_candidates.sql`). Routing maps
  directly to status: `auto_merge` → `auto_approved` ("safe to suppress duplicate
  presentation," never "merged"), `review` → `pending_review`, `separate` → `separate`
  (persisted too, so an unchanged pair isn't re-evaluated for nothing on the next scan).
  Idempotent: re-running an unchanged evaluation updates the existing row, never inserts
  a duplicate. Critically, it **never downgrades a human decision**
  (`confirmed_same`/`confirmed_different`, set only by `decideCandidate`, the CLI review
  commands' only write path) back to an engine-derived status — a later scan still
  refreshes the observed score/signals/evaluatedAt for the audit trail, but leaves
  `status`/`decision_source` untouched once a human has decided.
- **`representative.ts`** — `selectRepresentative(a, b)`, a small, explainable, pure
  policy (never trusting `qualityScore`/`rankingScore`, still M2 provisional
  placeholders): (1) more useful public fields filled in — completeness, weighted so a
  venue *with coordinates* reliably beats one without (protects "nearby" for the pair,
  never silently drops geo); (2) higher max source confidence; (3) event id as a
  deterministic tie-breaker. This only decides which event to *show*; it never copies a
  field from one into the other.
- **`suppression.ts`** — `computeSuppressedEventIds(db)` reads every `auto_approved`/
  `confirmed_same` candidate, resolves the representative for each pair, and returns the
  set of *non*-representative event ids. `apps/api/src/server.ts` computes this before
  calling `discoverEvents`, passing it as `excludeEventIds` — applied inside the same SQL
  `WHERE` clause as every other discovery filter, so suppression always happens before
  `ORDER BY`/`LIMIT`/cursor pagination, never as an after-the-fact filter on an
  already-paginated page. `pending_review` and `confirmed_different`/`separate` pairs are
  never suppressed — both events stay independently visible until a human (or the engine,
  for `separate`) has ruled it out.

  Per-pair only: this does not chase transitive duplicate clusters (A~B and B~C doesn't
  imply A~C is resolved together) — real clustering is exactly the "field reconciliation"
  scope M9 deliberately excludes.

  A suppressed event's own `/v1/events/{slug}` and `/eventos/{slug}` stay fully
  reachable — only `GET /v1/events` (discovery/listing) is affected. No redirect was
  added without an explicit architectural decision to do so (M9 section 23).

### Suppression performance at synthetic scale (M10)

`apps/worker/src/commands/perf-check-dedup.ts` is a manually-run (not CI, not a permanent
benchmark suite) measurement tool: seeds a synthetic dataset, times
`computeSuppressedEventIds` and `discoverEvents(..., { excludeEventIds })`, and cleans up
after itself. At 2,000 synthetic events / 300 suppressing pairs (600 events involved — far
above the current real dataset size), `computeSuppressedEventIds` took ~93ms and
`discoverEvents` with all 300 ids in its `NOT IN` clause took ~16ms. No objective problem was
found, so no caching/optimization was added (M10 section 37: "não criar cache antes de
medir"). Re-run with `PERF_EVENT_COUNT`/`PERF_SUPPRESSING_PAIRS` env vars if the real dataset
grows enough to warrant re-checking.

### Ops summary (`src/ops/summary.ts`)

`computeOpsSummary(db)` — honestly-available metrics only, no invented uptime or health
score: canonical event count, raw pending/failed counts, dedup status counts, and
per-source health (enabled, last raw `fetched_at`, raw success/failed counts, canonical
reference count). This is the foundation for a future operational UI — no such UI exists
yet, and none was built in M9 (CLI only; see `apps/worker`'s README/`pnpm ops:summary`).

## Limitations

- No dedicated categories/performers/organizers tables — categories are a free-text
  `category_id`, performers/organizer are inline JSON on `events`.
- Dedup suppression is per-pair, not transitive-cluster-aware (see "Dedup" above).
- No physical merge: a suppressed event's data is never reconciled into its
  representative — if the representative is missing a field the suppressed sibling had
  (other than the geo-completeness case the representative policy already accounts for),
  that field is simply not shown, by design (M9 section 21).
