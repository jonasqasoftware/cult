import { describe, expect, it } from "vitest";
import { assessAutoMergeEligibility } from "./eligibility.js";

describe("assessAutoMergeEligibility", () => {
  it("is eligible for a timed-vs-timed pair", () => {
    const result = assessAutoMergeEligibility("timed_pair");
    expect(result.eligible).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("is eligible for a date-vs-date pair", () => {
    const result = assessAutoMergeEligibility("date_pair");
    expect(result.eligible).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it("is NOT eligible for a mixed-precision pair, with a human-readable blocker", () => {
    const result = assessAutoMergeEligibility("mixed_precision");
    expect(result.eligible).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.blockers[0]).toMatch(/time precision/i);
  });
});
