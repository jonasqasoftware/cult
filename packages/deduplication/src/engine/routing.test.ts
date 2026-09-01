import { describe, expect, it } from "vitest";
import { AUTO_MERGE_THRESHOLD, decideRouting, REVIEW_THRESHOLD } from "./routing.js";
import type { AutoMergeEligibility } from "./eligibility.js";

const ELIGIBLE: AutoMergeEligibility = { eligible: true, blockers: [] };
const INELIGIBLE: AutoMergeEligibility = { eligible: false, blockers: ["mixed temporal precision"] };

describe("decideRouting", () => {
  it("routes a very high score with no conflicts to auto_merge", () => {
    expect(decideRouting(0.995, [], ELIGIBLE)).toBe("auto_merge");
  });

  it("routes a mid-range score with no conflicts to review", () => {
    expect(decideRouting(0.85, [], ELIGIBLE)).toBe("review");
  });

  it("routes a low score with no conflicts to separate", () => {
    expect(decideRouting(0.5, [], ELIGIBLE)).toBe("separate");
  });

  it("never auto_merges when a critical conflict is present, even with a very high score", () => {
    expect(decideRouting(0.99, ["venue_conflict"], ELIGIBLE)).not.toBe("auto_merge");
    expect(decideRouting(0.99, ["date_conflict"], ELIGIBLE)).not.toBe("auto_merge");
  });

  it("routes a high score with only a soft conflict (venue) to review, not separate", () => {
    expect(decideRouting(0.9, ["venue_conflict"], ELIGIBLE)).toBe("review");
    expect(decideRouting(0.4, ["venue_conflict"], ELIGIBLE)).toBe("review");
  });

  it("routes to separate whenever a strong conflict is present, regardless of score", () => {
    expect(decideRouting(0.4, ["date_conflict"], ELIGIBLE)).toBe("separate");
    expect(decideRouting(0.9, ["time_conflict"], ELIGIBLE)).toBe("separate");
    expect(decideRouting(0.9, ["city_conflict"], ELIGIBLE)).toBe("separate");
    expect(decideRouting(0.9, ["edition_conflict"], ELIGIBLE)).toBe("separate");
  });

  it("treats a mix of soft and strong conflicts as strong", () => {
    expect(decideRouting(0.9, ["venue_conflict", "date_conflict"], ELIGIBLE)).toBe("separate");
  });

  it("is exact at the auto_merge threshold boundary", () => {
    expect(decideRouting(AUTO_MERGE_THRESHOLD, [], ELIGIBLE)).toBe("auto_merge");
    expect(decideRouting(AUTO_MERGE_THRESHOLD - 0.01, [], ELIGIBLE)).not.toBe("auto_merge");
  });

  it("is exact at the review threshold boundary", () => {
    expect(decideRouting(REVIEW_THRESHOLD, [], ELIGIBLE)).toBe("review");
    expect(decideRouting(REVIEW_THRESHOLD - 0.01, [], ELIGIBLE)).toBe("separate");
  });

  // M6.1: auto-merge eligibility (mixed temporal precision) is a separate axis from score and
  // conflicts — a perfect score with no conflicts can still be blocked from auto_merge.
  it("never auto_merges when ineligible, even with a perfect score and no conflicts", () => {
    expect(decideRouting(1.0, [], INELIGIBLE)).not.toBe("auto_merge");
  });

  it("routes an ineligible, high-scoring, conflict-free pair to review, not separate", () => {
    expect(decideRouting(1.0, [], INELIGIBLE)).toBe("review");
    expect(decideRouting(REVIEW_THRESHOLD, [], INELIGIBLE)).toBe("review");
  });

  it("routes an ineligible, low-scoring pair to separate", () => {
    expect(decideRouting(REVIEW_THRESHOLD - 0.01, [], INELIGIBLE)).toBe("separate");
  });

  it("still separates an ineligible pair with a strong conflict", () => {
    expect(decideRouting(0.9, ["date_conflict"], INELIGIBLE)).toBe("separate");
  });
});
