# ADR-0014 — EventOccurrence cannot yet represent date-only or multi-day-range events

## Status
Proposed (open question — no domain change made in M3)

## Context
`EventOccurrence.startsAt` (packages/domain) requires a precise `Date` — a specific instant.
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
means the current domain model cannot honestly construct an `EventOccurrence` for either
case. The M3 normalizer treats both as an explicit normalization failure (raw payload still
preserved per ADR-0006/0013), which is correct but means a real, non-trivial share of
Destino POA's actual catalog cannot be ingested yet.

## Decision
No decision yet. This ADR exists to name the gap and stop the affected part of M3's scope
from silently working around it (e.g. by picking an arbitrary time), per the instruction
that domain changes are never made silently.

## Options considered (not chosen — for a future milestone to decide)

1. **Precision flag on EventOccurrence** — add something like
   `precision: "exact" | "date-only"`, keeping `startsAt`/`endsAt` as `Date` but at
   day-granularity when `precision === "date-only"`, and teaching ranking/discovery to
   treat date-only occurrences accordingly (e.g. never claim a specific hour in the UI).
2. **Separate DateRange type** — model multi-day/no-time events as a distinct concept
   from a point-in-time `EventOccurrence`, at the cost of two shapes for API/ranking code
   to handle.
3. **Explode a range into daily occurrences** — turn a 22-day exhibition into 22
   `EventOccurrence` rows. Simplest to query, but implies a "time" (still none exists) and
   inflates the occurrence count for something that is really one continuous listing.

## Consequences (of not deciding yet)
- Destino POA (and likely future sources) will keep failing normalization for date-only
  and ranged events until this is resolved — visible in `raw_events.processing_status =
  'failed'` with an explicit, honest reason, never silently dropped or guessed.
- This is documented as real product/data debt in the M3 execution report, not swept under
  a workaround.
