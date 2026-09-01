# Cross-source Deduplication Golden Dataset

**Status: reference dataset only. No matching algorithm exists yet (M6+).**

## Purpose

This is the ground truth a future Deduplication Engine will be developed against and
evaluated on. It exists *before* any matching algorithm, deliberately: the dataset defines
what "correct" means, so the algorithm can be judged against it — never the other way
around.

`cases.json` holds 40 hand-authored pairs of synthetic, Porto-Alegre-plausible cultural
events (no real event content is reproduced). Tooling to load, validate and summarize it
lives in `packages/deduplication/src/golden-dataset/` (types, loader, validator, summary —
not an engine; see that package's `src/index.ts` for what is and is not implemented).

## Truth vs. routing — two different questions

Every case answers two separate questions, and conflating them is a common mistake this
dataset is designed to prevent:

- **`identityTruth`** — what the two records *actually represent*, as a fact:
  - `same` — we know both records describe the same real-world cultural event.
  - `different` — we know they describe two distinct events.
  - `uncertain` — the available information does not permit a safe decision either way.
- **`expectedRouting`** — what a dedup engine *should do* given the truth AND the evidence
  actually available:
  - `auto_merge` — a strong, low-risk case for automatic merging.
  - `review` — send to a human/candidate review queue.
  - `separate` — keep as distinct `CanonicalEvent` records.

These do not collapse into each other. Two examples from this dataset:

- `GD-P13`: `identityTruth: same` (by construction, we know it's the same vernissage) but
  `expectedRouting: review` — one source reports a precise time and the other only a date;
  merging automatically would silently overstate the date-only record's precision.
- `GD-A01`: `identityTruth: uncertain`, `expectedRouting: review` — the historical
  "Rock in Porto Alegre" pair (Ticketmaster vs. Destino POA, conflicting venues). Its label
  is carried over unchanged from `test-data/golden-events/cross-source-candidates.md`
  (M3) — see "Label change policy" below.

## Critical conflict vocabulary

Kept intentionally small and closed. A case's `criticalConflicts` array may only use these
values (enforced by the validator):

| Value | Meaning |
|---|---|
| `venue_conflict` | The two records name/locate different venues with no confirmed alias relationship. |
| `date_conflict` | The two records occur on different dates. |
| `time_conflict` | Same date, but times are far enough apart to suggest separate sessions. |
| `performer_conflict` | Performers named are inconsistent with the same booking. |
| `city_conflict` | Records disagree on city (relevant once sources beyond Porto Alegre exist). |
| `event_scope_conflict` | One record describes a broader event (a festival, an exhibition run) and the other a narrower one nested inside it (a specific act, a sub-workshop, an opening night). |
| `edition_conflict` | Same title stem, different yearly/numbered edition. |

Do not add a new value without updating this table and `types.ts`'s
`CRITICAL_CONFLICT_VOCABULARY`.

## Tag glossary

Tags describe *what makes a case interesting/difficult* for future performance breakdowns
(`pnpm dedup:dataset:summary` reports tag frequency). They are free-form but should stay
descriptive and reusable — check existing tags before inventing a new one. Notable ones used
in this dataset: `exact-title`, `case`, `accent`, `punctuation`, `title-variation`,
`editorial-suffix`, `similar-title`, `generic-title`, `same-title-prefix`, `venue-alias`,
`unconfirmed-alias`, `different-venue`, `same-venue`, `geo-close`, `geo-distant`, `timed`,
`date-only`, `date-range`, `mixed-precision`, `missing-time`, `time-shift`,
`offset-equivalent`, `same-performer`, `missing-performer`, `missing-description`,
`missing-image`, `missing-price`, `missing-url`, `missing-venue`, `partial-address`,
`category-mismatch`, `recurring`, `festival-subevent`, `edition`, `tribute`,
`event_scope_conflict` (as a concept — see table above), `reschedule-ambiguous`,
`same-day`, `different-date`, `different-title`, `same-time`, `free`.

## Difficulty

`easy` / `medium` / `hard` — metadata for future evaluation breakdowns, **not** an expected
algorithm outcome. Roughly: exact/near-exact signals → easy; one weak or missing signal, or
a plausible alias → medium; multiple compounded ambiguities, or genuine scope/edition
questions → hard.

## Label change policy

**The dataset is truth. Algorithms are judged against it, never the reverse.**

- Never change `identityTruth` or `expectedRouting` on an existing case because an algorithm
  disagreed with it. If an algorithm's output differs from the dataset, that is either a bug
  in the algorithm or a legitimate finding to discuss — not grounds to edit the label.
  Diagnosing "the algorithm is wrong" vs. "the label needs re-examination" is always a
  separate, deliberate act of human judgment, never an automatic side effect of a test run.
- A label may only change when a human reviewer determines the ORIGINAL label was factually
  wrong (e.g. new information about the historical `GD-A01` pair genuinely resolves the
  venue conflict) — in a commit whose message states the reason.
- New cases are always welcome; edits to existing `identityTruth`/`expectedRouting` values
  require the same scrutiny as changing a fixed-point test's expected value in production
  code — because that is exactly what this is.

## Adding a new case

1. Pick the next free ID in the right family (`GD-P##` same/positive, `GD-N##`
   different/negative, `GD-A##` ambiguous), or a new family if the case doesn't fit those
   three story types.
2. Give both `left` and `right` fixtures stable IDs derived from the case ID
   (`GD-P16-A`, `GD-P16-B`) — never a runtime-generated UUID.
3. Fill in `identityTruth`, `expectedRouting`, `criticalConflicts` (only from the vocabulary
   above), `rationale` (concrete — say exactly which signals agree/disagree, and for
   `uncertain` cases, exactly what information is missing), `tags`, and `difficulty`.
4. Avoid **leakage** — never let the label be readable from the data itself (no titles like
   "Same Event Test"). Avoid **near-duplication** — a case that only tweaks one letter from
   an existing case adds no evaluation value.
5. Run `pnpm --filter @cult/deduplication test` (or the full `pnpm test`) — the dataset test
   loads every fixture through the real domain factories and validates the file as a whole;
   an invalid case fails CI.
6. Run `pnpm dedup:dataset:summary` to see the new distribution.

## Running the tooling

```bash
pnpm --filter @cult/deduplication test   # loads + validates every case (also runs in `pnpm test`)
pnpm dedup:dataset:summary                # pure statistics — zero matching, zero scoring
```

## How the future Deduplication Engine should use this dataset

- Compare `CanonicalEvent` to `CanonicalEvent` — never raw provider payloads. This dataset
  already provides both sides as real `CanonicalEvent` objects (via
  `packages/deduplication/src/golden-dataset/loader.ts`), which is deliberate: whatever
  normalizer produced them is irrelevant to matching.
- Evaluate against `identityTruth`, not `expectedRouting`, when scoring raw
  same/different/uncertain accuracy.
- Evaluate the engine's *routing decision* separately, against `expectedRouting` — a
  correct identity call with the wrong routing (e.g. auto-merging a `review`-only case) is
  still a bug worth catching.
- Break results down by `tags` and `difficulty` to see where the engine is weak, not just an
  aggregate score.
- Treat `criticalConflicts` as documentation of *why* a case is hard, not as an input feature
  to the engine — the engine must discover these signals itself from the `CanonicalEvent`
  data, not read the answer key.
