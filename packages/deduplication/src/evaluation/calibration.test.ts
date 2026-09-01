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

// M6.1 (section 19): after the auto-merge eligibility hardening, all four hard safety gates
// are validated against the FULL 40-case dataset, not just calibration. This is a deliberate,
// one-time widening of scope, not routine holdout-tuning: the fix that makes these pass
// (auto-merge eligibility, keyed only on structural temporal evidence) was designed from
// calibration-set reasoning about ADR-0014, not by special-casing the holdout case that
// exposed it. See "M6.1 holdout note" below for why the original holdout partition can no
// longer be reported as a blind generalization estimate.
describe("deduplication engine — M6.1 full-dataset safety gates", () => {
  const { results, metrics } = evaluateCases(selectPartition(loadDedupCases(), "all"));

  it("never auto-merges a known-different pair anywhere in the golden dataset", () => {
    expect(metrics.falseAutoMergesOfKnownDifferent).toBe(0);
  });

  it("never auto-merges an uncertain pair anywhere in the golden dataset", () => {
    expect(metrics.falseAutoMergesOfUncertain).toBe(0);
  });

  it("routes the historical GD-A01 ('Rock in Porto Alegre') pair to review, never auto_merge", () => {
    const gdA01 = results.find((r) => r.caseId === "GD-A01");
    expect(gdA01).toBeDefined();
    expect(gdA01?.assessment.routing).toBe("review");
  });

  it("never auto_merges a mixed-temporal-precision pair anywhere in the golden dataset", () => {
    const mixedPrecisionAutoMerges = results.filter(
      (r) => !r.assessment.autoMergeEligible && r.assessment.routing === "auto_merge",
    );
    expect(mixedPrecisionAutoMerges).toEqual([]);
  });
});

// Explicit named regressions (sections 20/21) for the two cases whose mis-routing motivated
// M6.1. The engine itself never sees a case id — this comparison happens only here, in the
// evaluation layer, exactly like every other case in this file.
describe("deduplication engine — M6.1 named regressions", () => {
  const { results } = evaluateCases(selectPartition(loadDedupCases(), "all"));

  it("GD-A03 (uncertain, mixed precision, otherwise-perfect match) routes to review", () => {
    const gdA03 = results.find((r) => r.caseId === "GD-A03");
    expect(gdA03).toBeDefined();
    expect(gdA03?.assessment.routing).toBe("review");
    expect(gdA03?.assessment.autoMergeEligible).toBe(false);
  });

  it("GD-P13 (same, mixed precision) routes to review, not auto_merge, without any per-case handling", () => {
    const gdP13 = results.find((r) => r.caseId === "GD-P13");
    expect(gdP13).toBeDefined();
    expect(gdP13?.assessment.routing).toBe("review");
    expect(gdP13?.assessment.autoMergeEligible).toBe(false);
  });
});

// M6.1 holdout note (sections 17/18): the original M6 holdout partition was a genuine,
// never-tuned-against blind estimate at the time it was first evaluated. GD-A03's failure on
// that first run is exactly what motivated this patch, so any run of the holdout partition
// AFTER this commit is a regression check against a now-inspected case, not an unbiased
// generalization estimate. The original M6 numbers are preserved as history in
// packages/deduplication/README.md; do not report a post-M6.1 holdout run as if it were still
// blind, and do not carve out a "new" holdout from the same 40 cases to simulate one.
