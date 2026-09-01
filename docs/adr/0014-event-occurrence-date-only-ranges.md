# ADR-0014 — EventOccurrence as a discriminated union (timed vs. date-only)

## Status
Accepted

## Context
`EventOccurrence.startsAt` (packages/domain) required a precise `Date` — a specific instant.
Ticketmaster's Discovery API always provides that (M2.1 already rejects its rare
localDate-only case rather than inventing a `00:00` time). Destino POA's real listings
(confirmed during the M3 discovery spike against the live site) frequently do **not**
provide that precision:

- **Date-only, single day** — e.g. an event listed for "10 de outubro de 2026" with no
  time of day at all.
- **Multi-day ranges with no time** — e.g. "29 de agosto a 20 de setembro de 2026" for a
  park exhibition/encampment-style event. This is common for exhibitions, fairs, and
  season-long installations, not an edge case.

Applying M2.1's own rule consistently — never invent a time of day to satisfy the schema —
meant the M3 domain model could not honestly construct an `EventOccurrence` for either case;
both failed normalization explicitly. M4 resolves this gap.

## Decision
`EventOccurrence` is a discriminated union, keyed on `kind`:

```ts
type EventOccurrence = TimedEventOccurrence | DateOnlyEventOccurrence;

interface TimedEventOccurrence {
  readonly kind: "timed";
  readonly startsAt: Date;
  readonly endsAt?: Date;
  // ...id, eventId, timezone, status
}

interface DateOnlyEventOccurrence {
  readonly kind: "date";
  readonly startDate: string; // "YYYY-MM-DD"
  readonly endDate?: string;  // "YYYY-MM-DD", inclusive
  // ...id, eventId, timezone, status
}
```

Built via two explicit factories, `createTimedEventOccurrence` and
`createDateOnlyEventOccurrence` — never one factory with a pile of optional fields that
would let an invalid combination (e.g. both `startsAt` and `startDate`) exist.
`startDate`/`endDate` are plain strings, never a JS `Date` — a date-only value is never
round-tripped through an instant. Both bounds of a range are **inclusive** in CULT's domain
semantics; converting to a format with different range semantics (e.g. iCalendar's exclusive
`DTEND`) is an adapter/exporter concern, never the domain's (see "iCalendar" below).

### Why not the alternatives considered in the original (Proposed) version of this ADR

- **Precision flag on `Date`** (`precision: "exact" | "date-only"` while keeping
  `startsAt`/`endsAt` as `Date`) — rejected because it would still require manufacturing an
  artificial instant (a `Date` object) to represent something that has no time component.
  The flag would document the fabrication without preventing it — any code that reads
  `startsAt` directly could still misuse a date-only value as if it were precise.
- **Explode a range into daily occurrences** — rejected because a 22-day exhibition is not
  22 independent occurrences; it is one continuous listing. Exploding it would inflate
  occurrence counts, complicate "how many times does this happen" logic, and still implies a
  time-of-day granularity that doesn't exist.
- **A `DateRange` type entirely separate from `EventOccurrence`** — rejected because both
  forms answer the same domain question ("when does this happen") for the same conceptual
  slot on a `CanonicalEvent` (`occurrences: EventOccurrence[]`). A discriminated union
  expresses that safely — `CanonicalEvent.occurrences` keeps a single, uniform array type
  instead of two parallel arrays call sites would have to remember to check.

## Consequences

- `packages/database`: `event_occurrences` gained `temporal_kind`, `start_date`, `end_date`;
  `starts_at`/`ends_at` became nullable. CHECK constraints enforce that a row's populated
  columns actually match its `temporal_kind` (see migration `0001_*`), so an invalid shape is
  rejected by Postgres itself, not just by the domain factory.
- `openapi/cult-api.yaml`: `EventOccurrence` is now `oneOf` `TimedEventOccurrence` /
  `DateOnlyEventOccurrence` with a `kind` discriminator. A date-only occurrence is never
  serialized with a fabricated `T00:00:00` time.
- `apps/api`'s response mapper switches exhaustively on `kind` — adding a third kind in the
  future without updating that switch is a compile error, not a silent gap.
- Ticketmaster's normalizer is unaffected: it only ever produces `kind: "timed"`, and a
  Ticketmaster event with only a `localDate` (no `dateTime`) still fails normalization
  explicitly (M2.1's rule stands — no evidence a `localDate`-only Ticketmaster event is
  semantically "all-day" rather than just missing data).
- Destino POA's normalizer now succeeds for both previously-failing cases (date-only single
  day, date-only range) — see the M4 execution report for before/after fixture counts.
- **Discovery semantics for M6** (documented now, not implemented): a date-only occurrence
  with `startDate <= today <= endDate` (or `today === startDate` when `endDate` is absent) is
  "active" that day. Date-only does **not** mean "happening 24 hours a day" — it means only
  "the source did not report time precision." Ranking/"Acontecendo agora" must not treat a
  date-only occurrence as continuously live; that logic is not implemented in M4.
- **SEO/Schema.org** (documented, not implemented): Schema.org's `Event.startDate` accepts
  both a `DateTime` and a plain `Date`, so both kinds map directly once product UI exists —
  no JSON-LD is generated in M4.
- **iCalendar** (documented, not implemented): RFC 5545 has distinct `DATE` and `DATE-TIME`
  value types, and `DTEND` for a `DATE`-typed range is exclusive of its last day — the
  opposite of CULT's inclusive `endDate`. Any future `.ics` export must perform that
  conversion (e.g. `endDate + 1 day`) in the exporter/adapter; the domain must not carry
  iCalendar-specific range semantics.
