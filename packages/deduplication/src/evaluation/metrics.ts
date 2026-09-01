import type { DedupAssessment, Routing } from "../engine/assess.js";
import type { Difficulty, ExpectedRouting, IdentityTruth } from "../golden-dataset/types.js";

export interface CaseResult {
  readonly caseId: string;
  readonly identityTruth: IdentityTruth;
  readonly expectedRouting: ExpectedRouting;
  readonly difficulty: Difficulty;
  readonly temporalPairing: string;
  readonly assessment: DedupAssessment;
}

export interface EvaluationMetrics {
  readonly totalCases: number;
  readonly routingAccuracy: number;
  readonly confusionMatrix: Record<string, Record<string, number>>;
  readonly accuracyByDifficulty: Record<string, number>;
  readonly accuracyByTruth: Record<string, number>;
  readonly accuracyByTemporalPairing: Record<string, number>;
  readonly autoMergePrecision: number | null;
  readonly autoMergeRecall: number | null;
  readonly separatePrecision: number | null;
  readonly reviewRate: number;
  readonly falseAutoMerges: number;
  readonly falseAutoMergesOfKnownDifferent: number;
  readonly falseAutoMergesOfUncertain: number;
  readonly falseSeparates: number;
  readonly incorrectCases: readonly CaseResult[];
}

// Pure statistics over already-computed assessments — no scoring/matching happens here.
// "Known truth" for auto-merge precision/recall means same/different only (section 33) —
// uncertain cases are excluded from that specific calculation but still counted toward
// false-auto-merge safety metrics and overall routing accuracy.
export function computeMetrics(results: readonly CaseResult[]): EvaluationMetrics {
  const isCorrect = (r: CaseResult) => r.assessment.routing === r.expectedRouting;
  const correctCount = results.filter(isCorrect).length;

  const confusionMatrix = groupCount(
    results,
    (r) => r.expectedRouting,
    (r) => r.assessment.routing,
  );

  const autoMergePredictions = results.filter((r) => r.assessment.routing === "auto_merge");
  const trueSameCases = results.filter((r) => r.identityTruth === "same");
  const trueDifferentCases = results.filter((r) => r.identityTruth === "different");
  const separatePredictions = results.filter((r) => r.assessment.routing === "separate");

  const autoMergePrecision =
    autoMergePredictions.length > 0
      ? autoMergePredictions.filter((r) => r.identityTruth === "same").length / autoMergePredictions.length
      : null;
  const autoMergeRecall =
    trueSameCases.length > 0
      ? trueSameCases.filter((r) => r.assessment.routing === "auto_merge").length / trueSameCases.length
      : null;
  const separatePrecision =
    separatePredictions.length > 0
      ? separatePredictions.filter((r) => r.identityTruth === "different").length / separatePredictions.length
      : null;

  const falseAutoMergesOfKnownDifferent = trueDifferentCases.filter(
    (r) => r.assessment.routing === "auto_merge",
  ).length;
  const falseAutoMergesOfUncertain = results.filter(
    (r) => r.identityTruth === "uncertain" && r.assessment.routing === "auto_merge",
  ).length;

  return {
    totalCases: results.length,
    routingAccuracy: results.length > 0 ? correctCount / results.length : 0,
    confusionMatrix,
    accuracyByDifficulty: groupAccuracy(results, (r) => r.difficulty, isCorrect),
    accuracyByTruth: groupAccuracy(results, (r) => r.identityTruth, isCorrect),
    accuracyByTemporalPairing: groupAccuracy(results, (r) => r.temporalPairing, isCorrect),
    autoMergePrecision,
    autoMergeRecall,
    separatePrecision,
    reviewRate: results.length > 0 ? results.filter((r) => r.assessment.routing === "review").length / results.length : 0,
    falseAutoMerges: falseAutoMergesOfKnownDifferent + falseAutoMergesOfUncertain,
    falseAutoMergesOfKnownDifferent,
    falseAutoMergesOfUncertain,
    falseSeparates: results.filter((r) => r.identityTruth === "same" && r.assessment.routing === "separate").length,
    incorrectCases: results.filter((r) => !isCorrect(r)),
  };
}

function groupAccuracy(
  results: readonly CaseResult[],
  keyOf: (r: CaseResult) => string,
  isCorrect: (r: CaseResult) => boolean,
): Record<string, number> {
  const totals = new Map<string, { correct: number; total: number }>();
  for (const result of results) {
    const key = keyOf(result);
    const entry = totals.get(key) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (isCorrect(result)) entry.correct += 1;
    totals.set(key, entry);
  }
  const output: Record<string, number> = {};
  for (const [key, { correct, total }] of totals) {
    output[key] = total > 0 ? correct / total : 0;
  }
  return output;
}

function groupCount(
  results: readonly CaseResult[],
  rowKeyOf: (r: CaseResult) => string,
  colKeyOf: (r: CaseResult) => Routing,
): Record<string, Record<string, number>> {
  const matrix: Record<string, Record<string, number>> = {};
  for (const result of results) {
    const row = rowKeyOf(result);
    const col = colKeyOf(result);
    matrix[row] ??= {};
    matrix[row][col] = (matrix[row][col] ?? 0) + 1;
  }
  return matrix;
}
