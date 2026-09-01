import type { TemporalEvidence } from "../signals/temporal.js";

// Distinct from the numeric score: an assessment can be a perfect similarity match
// (score/temporal similarity = 1.0) while still not being strong enough evidence for an
// irreversible auto_merge. M6.1: "mixed temporal precision" (one side timed, the other
// date-only/date-range) is exactly this case — ADR-0014 means a date-only value never
// confirms the specific instant a timed value reports, no matter how well the calendar dates
// line up.
export interface AutoMergeEligibility {
  readonly eligible: boolean;
  readonly blockers: readonly string[];
}

export function assessAutoMergeEligibility(temporalEvidence: TemporalEvidence): AutoMergeEligibility {
  if (temporalEvidence === "mixed_precision") {
    return {
      eligible: false,
      blockers: ["one source does not report time precision (mixed timed/date-only evidence)"],
    };
  }
  return { eligible: true, blockers: [] };
}
