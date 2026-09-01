# @cult/deduplication

An in-memory, pure-function engine that assesses whether two `CanonicalEvent`s from
different sources probably describe the same real-world event, plus the golden-dataset
tooling and calibration/holdout evaluation harness used to build and validate it.

This package does **not** persist anything, merge anything, or call the ingestion
pipeline, database, or API. It answers one question — given two events, how confident
are we, and why — and leaves the decision of what to do with that answer to a future
milestone (see "Limitations" below).

## Entry point

```ts
import { assessDuplicate } from "@cult/deduplication";

const assessment = assessDuplicate(left, right); // left, right: CanonicalEvent
```

`assessDuplicate` is a pure function: no database, no HTTP, no filesystem, no
environment variables, no clock, no randomness. The same two events always produce the
same `DedupAssessment`. It reads only the two `CanonicalEvent` objects — it never
receives (and never uses) a golden-dataset case id, label, rationale, or tag, and it
never uses `id`, `slug`, `sourceId`, or `externalId` as a similarity signal. The one
exception is `ticketUrl`/`canonicalUrl`: a genuinely shared public URL is legitimate
corroboration, not an internal identifier.

```ts
interface DedupAssessment {
  score: number; // 0..1
  routing: "auto_merge" | "review" | "separate";
  signals: {
    title: number;
    venue?: number;
    temporal: number;
    performer?: number;
    geo?: number;
    url?: number;
  };
  detectedConflicts: DetectedConflict[];
  autoMergeEligible: boolean; // M6.1 — see "Auto-merge eligibility" below
  autoMergeBlockers: string[];
  reasons: string[]; // human-readable explanation of the score/routing
}
```

## Signals

| Signal | Module | What it compares | Missing data |
| --- | --- | --- | --- |
| Title | `signals/title.ts` | Normalized token similarity (Dice/overlap) of the two titles | Titles are required on `CanonicalEvent`, so this signal is never missing |
| Venue | `signals/venue.ts` | Text similarity of venue name, weighted with address/neighborhood when present | `undefined` if either side has no venue |
| Temporal | `signals/temporal.ts` | See "Temporal signal" below | Always present — a missing occurrence is treated as fully incompatible, not "unknown" |
| Performer | `signals/performer.ts` | Name overlap (containment-aware) between performer lists | `undefined` if either side has no performers |
| Geo | `signals/geo.ts` | Haversine distance between venue coordinates, decayed to a 0..1 similarity | `undefined` if either side is missing coordinates |
| URL | `signals/url.ts` | Exact match of `ticketUrl`, falling back to `canonicalUrl` | `undefined` if neither side has a comparable URL on both sides |

Text normalization (`signals/text.ts`) is generic: Unicode NFD normalization, diacritic
stripping, lowercasing, punctuation removal, whitespace collapsing, tokenization, and a
small Portuguese stopword filter used only inside similarity scoring (not inside the
exported `tokenize`, which keeps function words). Nothing in this package hardcodes a
dataset-specific title, venue alias, or fixture id.

### Temporal signal

`EventOccurrence` is a discriminated union (`kind: "timed" | "date"`, ADR-0014), so two
occurrences can be compared in five ways: timed-vs-timed, date-vs-date, timed-vs-date,
date-range-vs-date-range, date-range-vs-timed. `assessTemporal` handles all five by
converting a timed instant to its **local date in `America/Sao_Paulo`** and modeling it
as a degenerate one-day range; every non-timed-vs-timed pairing then shares one
range-overlap function. `kind: "date"` is never interpreted as "the whole day, any
time" beyond that containment check — it only ever means "the source didn't report a
precise time." Timed-vs-timed compares real instants (not string equality), so
differently-formatted but equivalent instants (e.g. an explicit UTC offset vs a local
time) score as identical.

### Missing signals

A missing signal is "unknown," never "0" or "different." `engine/score.ts` renormalizes
the weighted average over only the signals that are actually present, so an event with
no venue or performer data is never penalized for it — it is scored purely on the
signals that *are* available.

## Auto-merge eligibility (M6.1)

`assessTemporal` (`signals/temporal.ts`) reports not just a numeric `similarity` but a
structural `evidence` classification — `"timed_pair"`, `"date_pair"`, or
`"mixed_precision"` — independent of the score. `engine/eligibility.ts` turns that into
an `AutoMergeEligibility { eligible, blockers }`, and `decideRouting` treats ineligible
exactly like a soft conflict: capped at `review` above the review threshold, `separate`
below it, **never** `auto_merge`, regardless of score.

**Why this exists:** a `timed` occurrence vs. a `date`-only occurrence on the same
calendar day can score a perfect `1.0` temporal similarity — same title, same venue,
same performer, same day, nothing to disagree about. But ADR-0014 is explicit that
`kind: "date"` means *"the source didn't report time precision,"* never *"this event
runs all day."* A date-only listing never confirms that it's specifically the 20:00
session a timed listing reports — it's compatible with it, not proof of it. Eligibility
and similarity are deliberately different axes: it is correct and expected to see
`temporal similarity: 1.00` together with `autoMergeEligible: false` in the same
assessment. The score is never artificially deflated to enforce this — that would make
the score lie about how similar the events look, and route based on a fiction instead
of an explainable rule.

`date`-vs-`date` (including date-range) pairs are **not** affected — both sides already
share the same (lack of) precision, so there's nothing "mixed" to flag; this scoped
narrowly to genuinely mixed pairs is deliberate (M6.1 section 9).

`DedupAssessment.reasons` always states the blocker in plain language when it applies,
e.g. `"auto-merge blocked: one source does not report time precision (mixed
timed/date-only evidence)"`, so `routing: review` next to a `score` of `1.00` is never
unexplained.

## Score and weights

```ts
export const BASELINE_WEIGHTS = { title: 0.4, venue: 0.2, temporal: 0.2, geo: 0.1, performer: 0.1 };
```

These are the MVP1 technical specification's historical hypothesis, used as-is: nothing
in calibration demonstrated a need to change them. (The **thresholds**, below, were
adjusted — the weights were not.) An exact `ticketUrl`/`canonicalUrl` match adds a small
(`+0.05`) bonus on top of the weighted average, capped at `1`.

## Critical conflicts

`engine/conflicts.ts` runs its own detectors — it never reads a golden-dataset
`criticalConflicts` annotation. It detects five of the seven conflict types in the
shared vocabulary, confidently:

- `date_conflict` / `time_conflict` — derived from the temporal signal
- `city_conflict` — venue cities differ
- `venue_conflict` — venues are far apart (when coordinates exist) or textually
  dissimilar (when they don't)
- `edition_conflict` — the titles contain different years (e.g. "Festival 2025" vs
  "Festival 2026")

It deliberately does **not** attempt `performer_conflict` or `event_scope_conflict` in
M6 — the spec calls both too fragile to detect reliably from title/performer text alone
without a much richer normalizer, and a false conflict here is itself a risk (it can
push a genuinely-same pair away from `auto_merge`).

## Routing

```ts
export const AUTO_MERGE_THRESHOLD = 0.99; // raised from the spec's 0.95 hypothesis — see below
export const REVIEW_THRESHOLD = 0.8;
```

Conflicts are split into two tiers, based on calibration evidence (not a fixed rule
from the spec):

- **Strong** (`date_conflict`, `time_conflict`, `city_conflict`, `edition_conflict`):
  routes straight to `separate`, regardless of score. In the calibration partition,
  every case where one of these fired was `identityTruth: "different"`.
- **Soft** (`venue_conflict` alone): caps routing at `review`, never lets a low score
  push it down to `separate`. In the calibration partition, every case where the
  *only* conflict was `venue_conflict` — with title and time otherwise matching — was
  `identityTruth: "uncertain"`, not `different`: a venue disagreement alone is treated
  as corroboration trouble, not proof of non-identity.

With no conflict and eligible for auto-merge (see "Auto-merge eligibility" above),
`score >= 0.99` routes `auto_merge`, `score >= 0.80` routes `review`, otherwise
`separate`. An ineligible pair with no conflict behaves like a soft conflict: `review`
at or above 0.80, `separate` below it — never `auto_merge`, no matter the score.

**Why 0.99, not the spec's 0.95 hypothesis:** every genuine same-event pair in the
calibration partition scored `>= 0.9984`. The closest false positive — an
`identityTruth: "uncertain"` pair with a 30-minute time gap between two sources — scored
`0.9688`. `0.95` would have auto-merged it; `0.99` sits with margin on both sides of the
observed calibration data. This is documented here rather than in a separate ADR because
it is a tuning-parameter adjustment within the already-accepted scoring design, not a new
architectural decision.

## Calibration vs. holdout

`evaluation/partitions.ts` hardcodes a deterministic 30/10 split of the 40-case golden
dataset, decided **before** any engine code was written:

- **Calibration** (30 cases, everything not listed as holdout): the only data used to
  design signals, pick weights, and pick thresholds. Every number in "Why 0.99" above
  comes from this partition.
- **Holdout** (10 cases, `HOLDOUT_CASE_IDS`): never used to tune anything. Evaluated
  exactly once, after calibration was finished, purely to report how the engine
  generalizes.

## Running the evaluation

```bash
pnpm dedup:evaluate:calibration
pnpm dedup:evaluate:holdout
pnpm dedup:evaluate:all
```

Each prints aggregate metrics (routing accuracy, confusion matrix, auto-merge
precision/recall, separate precision, review rate, false auto-merges, false separates,
breakdowns by difficulty/truth/temporal pairing) and, for every case the engine got
wrong, the case id, expected vs. actual routing, score, signal breakdown, and detected
conflicts. The comparison against expected labels happens only in this CLI
(`cli/evaluate.ts`) and the evaluation harness (`evaluation/evaluate.ts` and
`evaluation/metrics.ts`) — never inside the engine itself.

## Safety gates (hard, CI-enforced)

`evaluation/calibration.test.ts` parametrizes over the real dataset (never 30 manually
copied cases) and fails CI if any of these are violated. As of M6.1, all four are
checked against the **full 40-case dataset**:

- Zero false auto-merge of an `identityTruth: "different"` pair.
- Zero `identityTruth: "uncertain"` pair routed `auto_merge`.
- The historical `GD-A01` ("Rock in Porto Alegre") pair routed `review`.
- Zero pair with `autoMergeEligible: false` (mixed temporal precision) routed
  `auto_merge`.

Named regressions for the two cases that motivated M6.1 (`GD-A03`, `GD-P13`) are also
CI-enforced — see "M6.1: auto-merge eligibility hardening" below for why.

Quality targets (calibration routing accuracy ≥ 85%, holdout routing accuracy ≥ 70%,
auto-merge precision 100%) are aspirational and logged as a warning when missed — they
do not fail CI, and are never chased by tuning against holdout or editing the dataset.

## Results (Golden Dataset v1)

**M6 (original, before the eligibility hardening below) — preserved as history:**

| Partition | Cases | Routing accuracy | Auto-merge precision | Auto-merge recall | Review rate |
| --- | --- | --- | --- | --- | --- |
| Calibration | 30 | 83.3% | 100.0% | 100.0% | 16.7% |
| Holdout | 10 | 60.0% | 75.0% | 100.0% | 0.0% |
| All | 40 | 77.5% | 93.8% | 100.0% | 12.5% |

**M6.1 (current, after auto-merge eligibility hardening):**

| Partition | Cases | Routing accuracy | Auto-merge precision | Auto-merge recall | Review rate |
| --- | --- | --- | --- | --- | --- |
| Calibration | 30 | 83.3% (unchanged) | 100.0% | 100.0% | 16.7% |
| Holdout — **regression run, not blind** (see below) | 10 | 80.0% | 100.0% | 66.7% | 20.0% |
| All | 40 | 82.5% | **100.0%** | 93.3% | 17.5% |

Calibration is numerically unchanged — no calibration case has mixed temporal
precision, so the hardening only affects mixed-precision pairs, all of which live in
the holdout partition. Full-dataset auto-merge precision is now 100% (up from 93.8%),
with the trade-off that auto-merge *recall* drops slightly (93.3%, down from 100%):
two genuinely-same pairs that happen to have mixed temporal precision (`GD-P13`,
`GD-A03`) now correctly go to `review` instead of `auto_merge` — an intended
consequence of prioritizing auto-merge precision over recall, not a regression.

**Important caveat on the holdout number above:** the original M6 holdout run
(`60.0%`/`75.0%` in the table above it) was a genuine blind estimate at the time. The
`GD-A03` failure it surfaced is exactly what motivated this M6.1 patch, so the `80.0%`
figure here is a **regression check against a now-inspected case**, not a new unbiased
generalization estimate. No new, never-seen holdout exists for this dataset — a future
holdout v2 would need genuinely new, previously-unused labeled pairs. Every other
open item from the original M6 run (`GD-P04`, `GD-N01`, `GD-A04`, `GD-A06`, `GD-A07`,
`GD-A09`, `GD-A10`) is unchanged by M6.1 — mixed temporal precision was never the
reason any of those were misrouted, so they're left as documented, honest limitations
of the current six signals rather than "fixed" by this patch.

## Limitations

- Only the first/primary occurrence of each event is compared. An event with multiple
  occurrences (a multi-date run) is assessed on its first occurrence only.
- `performer_conflict` and `event_scope_conflict` are not detected (deliberately — see
  "Critical conflicts" above).
- Mixed temporal precision blocks `auto_merge` unconditionally, even when every other
  signal is a perfect match — by design (see "Auto-merge eligibility" above). This
  trades a small amount of auto-merge recall for auto-merge precision.
- No persistence, no merge, no ingestion-pipeline or API integration. See the M6 final
  report's "next step" note for what a follow-up milestone (candidate persistence and a
  review workflow, or the Discovery API) would need to add.
- Weights are the spec's historical hypothesis, unmodified; only thresholds and the
  auto-merge eligibility rule were calibrated/added.
- The 40-case Golden Dataset v1 no longer has a genuinely blind holdout partition after
  M6.1 (see "M6.1 holdout note" in the results section) — a future holdout v2 needs new,
  previously-unused labeled pairs.
