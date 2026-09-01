import { describe, expect, it } from "vitest";
import { loadDedupCases } from "../golden-dataset/loader.js";
import { evaluateCases, selectPartition } from "./evaluate.js";

// Hard, CI-enforced safety gates (section 38 of the M6 spec) — evaluated against the
// calibration partition, parametrized over the real dataset rather than hand-copied cases so
// it can never silently drift out of sync with test-data/golden-events/deduplication/cases.json.
// Never edit the Golden Dataset to make these pass; if a gate fails, the engine is wrong.
describe("deduplication engine — calibration safety gates", () => {
  const calibrationCases = selectPartition(loadDedupCases(), "calibration");
  const { results, metrics } = evaluateCases(calibrationCases);

  it("has a non-trivial calibration partition", () => {
    expect(calibrationCases.length).toBeGreaterThan(0);
  });

  it("never auto-merges a known-different pair", () => {
    expect(metrics.falseAutoMergesOfKnownDifferent).toBe(0);
  });

  it("never auto-merges an uncertain pair", () => {
    expect(metrics.falseAutoMergesOfUncertain).toBe(0);
  });

  it("routes the historical GD-A01 ('Rock in Porto Alegre') pair to review, never auto_merge", () => {
    const gdA01 = results.find((r) => r.caseId === "GD-A01");
    expect(gdA01).toBeDefined();
    expect(gdA01?.assessment.routing).toBe("review");
  });

  // Soft/aspirational quality targets (section 49) — reported, not CI-failing: a miss here is
  // not a regression to fix by touching the dataset or by tuning against holdout.
  it("reports calibration routing accuracy (target >= 85%, aspirational, non-blocking)", () => {
    if (metrics.routingAccuracy < 0.85) {
      console.warn(
        `[dedup calibration] routing accuracy ${(metrics.routingAccuracy * 100).toFixed(1)}% is below the 85% aspirational target`,
      );
    }
    expect(metrics.routingAccuracy).toBeGreaterThanOrEqual(0);
  });
});

// Gate (a) is explicitly scoped to "the FULL dataset" (calibration + holdout combined) — unlike
// the uncertain/GD-A01 gates above, checking it here does not require tuning against holdout:
// it is a structural invariant (never auto-merge a pair objectively known to be different), not
// a routing-accuracy target, so asserting it holds everywhere adds safety without violating the
// "never tune against holdout" rule.
describe("deduplication engine — full-dataset safety gate", () => {
  const { metrics } = evaluateCases(selectPartition(loadDedupCases(), "all"));

  it("never auto-merges a known-different pair anywhere in the golden dataset", () => {
    expect(metrics.falseAutoMergesOfKnownDifferent).toBe(0);
  });
});
