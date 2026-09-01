# Cross-source dedup candidates

> **Superseded by `test-data/golden-events/deduplication/` (M5).** This file's content is
> preserved unchanged for history — its decision below was carried forward verbatim into
> the structured dataset as case `GD-A01` (`identityTruth: uncertain`,
> `expectedRouting: review`), not silently reinterpreted. New cases and any future label
> changes belong in `deduplication/cases.json` — see `deduplication/README.md`.

Golden-dataset pairs prepared for the future deduplication milestone. **No matching is
implemented yet** — M3 deliberately keeps these as two separate `CanonicalEvent` rows (see
`apps/worker/src/multi-source-ingestion.test.ts`, "no cross-source dedup/merge happens in
M3"). This file only records which pairs a future dedup algorithm should be evaluated
against, and what a human reviewer currently believes the right answer is.

## Candidate pair 001

- **Ticketmaster:** `TM-EVT-COMPLETE-0001` — "Rock in Porto Alegre" — Arena do Grêmio —
  2026-11-20 23:00 UTC (`test-data/golden-events/ticketmaster/event-search-response.json`)
- **Destino POA:** `rock-in-porto-alegre-dpoa-2026` — "Rock in Porto Alegre" — Parque
  Maurício Sirotsky Sobrinho — 2026-11-20 20:00 -03:00 (`test-data/golden-events/destino-poa/agenda-feed.json`)

**Expected future decision:** likely a **fuzzy candidate for review**, not an automatic
merge. The two records share a title and a same-day date, but disagree on venue — that
disagreement is exactly the kind of "critical conflict" ADR-0006/the technical spec's
deduplication section says should block an automatic merge (`>= 0.95` auto-merge requires no
critical conflict). A future dedup milestone should route this pair to manual/candidate
review, not silently merge or silently keep both without flagging the relationship.

This is intentionally NOT a same-title coincidence — the fixtures were authored together so
this pair exists for exactly this purpose.
