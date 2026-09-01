import { describe, expect, it } from "vitest";
import { loadDedupCases, loadGoldenDataset } from "./loader.js";
import { summarizeGoldenDataset } from "./summary.js";
import { validateGoldenDataset } from "./validator.js";

// If any fixture is invalid, this test — and therefore CI — fails. The Golden Dataset is
// ground truth: this test only checks the dataset is well-formed, never whether any
// algorithm's output matches it (no algorithm exists yet).
describe("cross-source dedup golden dataset", () => {
  const dataset = loadGoldenDataset();

  it("passes structural validation", () => {
    const result = validateGoldenDataset(dataset);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it("has at least 40 cases", () => {
    expect(dataset.cases.length).toBeGreaterThanOrEqual(40);
  });

  it("every fixture constructs a real CanonicalEvent through the domain factories", () => {
    const loaded = loadDedupCases();
    expect(loaded).toHaveLength(dataset.cases.length);
    for (const { left, right } of loaded) {
      expect(left.title.length).toBeGreaterThan(0);
      expect(right.title.length).toBeGreaterThan(0);
      expect(left.occurrences.length).toBeGreaterThan(0);
      expect(right.occurrences.length).toBeGreaterThan(0);
    }
  });

  it("covers all three identity-truth classes and all three routing classes", () => {
    const summary = summarizeGoldenDataset(dataset);
    expect(Object.keys(summary.truth).sort()).toEqual(["different", "same", "uncertain"]);
    expect(Object.keys(summary.routing).sort()).toEqual(["auto_merge", "review", "separate"]);
  });

  it("covers timed, date-only and date-range occurrences", () => {
    const summary = summarizeGoldenDataset(dataset);
    const pairKinds = Object.keys(summary.temporalPairs).join(",");
    expect(pairKinds).toMatch(/timed/);
    expect(pairKinds).toMatch(/date(?!-range)/);
    expect(pairKinds).toMatch(/date-range/);
  });

  it("carries the historical Rock in Porto Alegre pair without silently changing its label", () => {
    const rockCase = dataset.cases.find((c) => c.id === "GD-A01");
    expect(rockCase).toBeDefined();
    expect(rockCase?.left.title).toBe("Rock in Porto Alegre");
    expect(rockCase?.right.title).toBe("Rock in Porto Alegre");
    // Matches the historical decision in the M3 cross-source-candidates.md: not a confident
    // "same", not a confident "different" — a review candidate.
    expect(rockCase?.identityTruth).toBe("uncertain");
    expect(rockCase?.expectedRouting).toBe("review");
  });
});
