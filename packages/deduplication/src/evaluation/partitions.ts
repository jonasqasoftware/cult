// Deterministic, versioned calibration/holdout split of the Golden Dataset — decided BEFORE
// any engine code was written (M6, section 7). Hand-picked (not a hash split) so the mix of
// truth/difficulty/temporal-pairing in each partition is guaranteed and auditable here,
// rather than hoping a random split happens to be representative.
//
// Holdout (10 cases): 3 same / 4 different / 3 uncertain; covers easy/medium/hard; covers
// timed-vs-timed, timed-vs-date (mixed precision), date-range-vs-date-range and
// date-range-vs-timed pairings. NEVER used to tune weights/thresholds/signals — see
// test-data/golden-events/deduplication/README.md and this package's README.md.
export const HOLDOUT_CASE_IDS: readonly string[] = [
  "GD-P02", // same, easy, timed-vs-timed (case)
  "GD-P08", // same, easy, timed-vs-timed (offset-equivalent)
  "GD-P13", // same, medium, timed-vs-date (mixed precision)
  "GD-N04", // different, easy, timed-vs-timed
  "GD-N07", // different, hard, timed-vs-timed (event_scope_conflict)
  "GD-N09", // different, medium, date-range-vs-date-range
  "GD-N10", // different, easy, timed-vs-timed (recurring)
  "GD-A03", // uncertain, medium, timed-vs-date (mixed precision)
  "GD-A06", // uncertain, hard, date-range-vs-timed (event_scope_conflict)
  "GD-A09", // uncertain, hard, timed-vs-date (city_conflict)
];

export function isHoldoutCase(caseId: string): boolean {
  return HOLDOUT_CASE_IDS.includes(caseId);
}
