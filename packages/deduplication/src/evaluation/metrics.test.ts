import { describe, expect, it } from "vitest";
import { computeMetrics, type CaseResult } from "./metrics.js";
import type { DedupAssessment } from "../engine/assess.js";

function assessment(routing: DedupAssessment["routing"], score = 0.5): DedupAssessment {
  return { score, routing, signals: { title: score, temporal: score }, detectedConflicts: [], reasons: [] };
}

function result(overrides: Partial<CaseResult> & Pick<CaseResult, "caseId" | "identityTruth" | "expectedRouting" | "assessment">): CaseResult {
  return { difficulty: "easy", temporalPairing: "timed-vs-timed", ...overrides };
}

describe("computeMetrics", () => {
  it("computes overall routing accuracy", () => {
    const results: CaseResult[] = [
      result({ caseId: "a", identityTruth: "same", expectedRouting: "auto_merge", assessment: assessment("auto_merge") }),
      result({ caseId: "b", identityTruth: "different", expectedRouting: "separate", assessment: assessment("review") }),
    ];
    const metrics = computeMetrics(results);
    expect(metrics.totalCases).toBe(2);
    expect(metrics.routingAccuracy).toBe(0.5);
  });

  it("computes a confusion matrix of expected vs. actual routing", () => {
    const results: CaseResult[] = [
      result({ caseId: "a", identityTruth: "same", expectedRouting: "auto_merge", assessment: assessment("auto_merge") }),
      result({ caseId: "b", identityTruth: "different", expectedRouting: "separate", assessment: assessment("review") }),
    ];
    const metrics = computeMetrics(results);
    expect(metrics.confusionMatrix.auto_merge?.auto_merge).toBe(1);
    expect(metrics.confusionMatrix.separate?.review).toBe(1);
  });

  it("computes auto-merge precision and recall against known truth (same/different only)", () => {
    const results: CaseResult[] = [
      result({ caseId: "a", identityTruth: "same", expectedRouting: "auto_merge", assessment: assessment("auto_merge") }),
      result({ caseId: "b", identityTruth: "different", expectedRouting: "separate", assessment: assessment("auto_merge") }),
      result({ caseId: "c", identityTruth: "same", expectedRouting: "auto_merge", assessment: assessment("review") }),
    ];
    const metrics = computeMetrics(results);
    // 2 auto_merge predictions, only 1 (case a) actually truth=same -> precision 0.5
    expect(metrics.autoMergePrecision).toBe(0.5);
    // 2 truth=same cases (a, c), only 1 (a) predicted auto_merge -> recall 0.5
    expect(metrics.autoMergeRecall).toBe(0.5);
  });

  it("counts false auto-merges of known-different and uncertain cases separately", () => {
    const results: CaseResult[] = [
      result({ caseId: "a", identityTruth: "different", expectedRouting: "separate", assessment: assessment("auto_merge") }),
      result({ caseId: "b", identityTruth: "uncertain", expectedRouting: "review", assessment: assessment("auto_merge") }),
      result({ caseId: "c", identityTruth: "same", expectedRouting: "auto_merge", assessment: assessment("auto_merge") }),
    ];
    const metrics = computeMetrics(results);
    expect(metrics.falseAutoMergesOfKnownDifferent).toBe(1);
    expect(metrics.falseAutoMergesOfUncertain).toBe(1);
    expect(metrics.falseAutoMerges).toBe(2);
  });

  it("computes review rate across all cases", () => {
    const results: CaseResult[] = [
      result({ caseId: "a", identityTruth: "same", expectedRouting: "auto_merge", assessment: assessment("review") }),
      result({ caseId: "b", identityTruth: "different", expectedRouting: "separate", assessment: assessment("separate") }),
    ];
    const metrics = computeMetrics(results);
    expect(metrics.reviewRate).toBe(0.5);
  });

  it("counts false separates: routed separate but truth is actually same", () => {
    const results: CaseResult[] = [
      result({ caseId: "a", identityTruth: "same", expectedRouting: "auto_merge", assessment: assessment("separate") }),
    ];
    const metrics = computeMetrics(results);
    expect(metrics.falseSeparates).toBe(1);
  });

  it("breaks accuracy down by difficulty, truth and temporal pairing", () => {
    const results: CaseResult[] = [
      result({ caseId: "a", identityTruth: "same", expectedRouting: "auto_merge", difficulty: "easy", temporalPairing: "timed-vs-timed", assessment: assessment("auto_merge") }),
      result({ caseId: "b", identityTruth: "different", expectedRouting: "separate", difficulty: "hard", temporalPairing: "date-vs-date", assessment: assessment("review") }),
    ];
    const metrics = computeMetrics(results);
    expect(metrics.accuracyByDifficulty.easy).toBe(1);
    expect(metrics.accuracyByDifficulty.hard).toBe(0);
    expect(metrics.accuracyByTruth.same).toBe(1);
    expect(metrics.accuracyByTruth.different).toBe(0);
    expect(metrics.accuracyByTemporalPairing["timed-vs-timed"]).toBe(1);
  });

  it("lists incorrect cases for the failure report", () => {
    const results: CaseResult[] = [
      result({ caseId: "a", identityTruth: "same", expectedRouting: "auto_merge", assessment: assessment("auto_merge") }),
      result({ caseId: "b", identityTruth: "different", expectedRouting: "separate", assessment: assessment("review") }),
    ];
    const metrics = computeMetrics(results);
    expect(metrics.incorrectCases).toHaveLength(1);
    expect(metrics.incorrectCases[0]?.caseId).toBe("b");
  });
});
