import type { DetectedConflict } from "./conflicts.js";
import type { AutoMergeEligibility } from "./eligibility.js";

export type Routing = "auto_merge" | "review" | "separate";

// Adjusted from the technical specification's 0.95 hypothesis after calibration: every
// genuine same-event calibration pair scored >= 0.9984, while the closest false-positive
// (an uncertain pair with a 30-minute time gap) scored 0.9688 — 0.95 would have auto-merged
// it. 0.99 sits strictly between the two with margin on both sides. Centralized here — never
// duplicate a literal threshold elsewhere in the codebase (section 30).
export const AUTO_MERGE_THRESHOLD = 0.99;
export const REVIEW_THRESHOLD = 0.8;

// date_conflict/time_conflict/city_conflict/edition_conflict are the "objective" conflict
// types the engine confidently detects (section 21): in calibration, every case where one of
// these fired was truth=different. venue_conflict alone is treated as softer corroboration
// trouble rather than proof of non-identity — in calibration, every case with ONLY a
// venue_conflict (matching title and matching time otherwise) was truth=uncertain, not
// different, e.g. two independently-listed sources disagreeing only on venue text.
const STRONG_CONFLICTS = new Set<DetectedConflict>(["date_conflict", "time_conflict", "city_conflict", "edition_conflict"]);

function hasStrongConflict(conflicts: readonly DetectedConflict[]): boolean {
  return conflicts.some((conflict) => STRONG_CONFLICTS.has(conflict));
}

// Safety-first (section 32/36): any detected conflict rules out auto_merge no matter how high
// the score is. A strong (objective) conflict routes straight to separate — calibration never
// showed a strong conflict co-occurring with a true "same"/"uncertain" pair. A conflict made
// up only of softer signals (currently just venue_conflict) caps routing at review instead of
// letting a low score push it down to separate — it's corroboration trouble, not proof of
// non-identity. Precision of auto_merge matters far more than recall — sending a truly same
// event to review is an acceptable cost; auto-merging two different events is not.
//
// M6.1: eligibility is a third, independent axis alongside score and conflicts — a perfect
// score with zero conflicts can still be blocked from auto_merge (e.g. mixed temporal
// precision, see engine/eligibility.ts). An ineligible pair behaves exactly like a soft
// conflict for routing purposes: capped at review above the review threshold, separate below
// it — never silently demoted straight to separate just because merging isn't safe yet.
export function decideRouting(
  score: number,
  conflicts: readonly DetectedConflict[],
  eligibility: AutoMergeEligibility,
): Routing {
  if (hasStrongConflict(conflicts)) return "separate";
  if (conflicts.length > 0) return "review";

  if (!eligibility.eligible) {
    return score >= REVIEW_THRESHOLD ? "review" : "separate";
  }

  if (score >= AUTO_MERGE_THRESHOLD) return "auto_merge";
  if (score >= REVIEW_THRESHOLD) return "review";
  return "separate";
}
