import { describe, expect, it } from "vitest";
import { AUTO_MERGE_THRESHOLD, decideRouting, REVIEW_THRESHOLD } from "./routing.js";

describe("decideRouting", () => {
  it("routes a very high score with no conflicts to auto_merge", () => {
    expect(decideRouting(0.995, [])).toBe("auto_merge");
  });

  it("routes a mid-range score with no conflicts to review", () => {
    expect(decideRouting(0.85, [])).toBe("review");
  });

  it("routes a low score with no conflicts to separate", () => {
    expect(decideRouting(0.5, [])).toBe("separate");
  });

  it("never auto_merges when a critical conflict is present, even with a very high score", () => {
    expect(decideRouting(0.99, ["venue_conflict"])).not.toBe("auto_merge");
    expect(decideRouting(0.99, ["date_conflict"])).not.toBe("auto_merge");
  });

  it("routes a high score with only a soft conflict (venue) to review, not separate", () => {
    expect(decideRouting(0.9, ["venue_conflict"])).toBe("review");
    expect(decideRouting(0.4, ["venue_conflict"])).toBe("review");
  });

  it("routes to separate whenever a strong conflict is present, regardless of score", () => {
    expect(decideRouting(0.4, ["date_conflict"])).toBe("separate");
    expect(decideRouting(0.9, ["time_conflict"])).toBe("separate");
    expect(decideRouting(0.9, ["city_conflict"])).toBe("separate");
    expect(decideRouting(0.9, ["edition_conflict"])).toBe("separate");
  });

  it("treats a mix of soft and strong conflicts as strong", () => {
    expect(decideRouting(0.9, ["venue_conflict", "date_conflict"])).toBe("separate");
  });

  it("is exact at the auto_merge threshold boundary", () => {
    expect(decideRouting(AUTO_MERGE_THRESHOLD, [])).toBe("auto_merge");
    expect(decideRouting(AUTO_MERGE_THRESHOLD - 0.01, [])).not.toBe("auto_merge");
  });

  it("is exact at the review threshold boundary", () => {
    expect(decideRouting(REVIEW_THRESHOLD, [])).toBe("review");
    expect(decideRouting(REVIEW_THRESHOLD - 0.01, [])).toBe("separate");
  });
});
