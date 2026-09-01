import type { CanonicalEvent, EventOccurrence } from "@cult/domain";
import { assessDuplicate } from "../engine/assess.js";
import type { LoadedDedupCase } from "../golden-dataset/loader.js";
import { computeMetrics, type CaseResult, type EvaluationMetrics } from "./metrics.js";
import { isHoldoutCase } from "./partitions.js";

export type PartitionName = "calibration" | "holdout" | "all";

export interface EvaluationResult {
  readonly results: readonly CaseResult[];
  readonly metrics: EvaluationMetrics;
}

// Runs the (already dataset-agnostic) engine over a set of loaded golden-dataset cases and
// aggregates the outcome. This is the ONLY place in the package where a case's identityTruth/
// expectedRouting is compared against an assessment — the engine itself never sees them.
export function evaluateCases(cases: readonly LoadedDedupCase[]): EvaluationResult {
  const results = cases.map(toCaseResult);
  return { results, metrics: computeMetrics(results) };
}

export function selectPartition(
  cases: readonly LoadedDedupCase[],
  partition: PartitionName,
): readonly LoadedDedupCase[] {
  if (partition === "all") return cases;
  return cases.filter((loaded) => isHoldoutCase(loaded.case.id) === (partition === "holdout"));
}

function toCaseResult(loaded: LoadedDedupCase): CaseResult {
  return {
    caseId: loaded.case.id,
    identityTruth: loaded.case.identityTruth,
    expectedRouting: loaded.case.expectedRouting,
    difficulty: loaded.case.difficulty,
    temporalPairing: temporalPairing(loaded.left, loaded.right),
    assessment: assessDuplicate(loaded.left, loaded.right),
  };
}

function temporalPairing(left: CanonicalEvent, right: CanonicalEvent): string {
  const leftOccurrence = left.occurrences[0];
  const rightOccurrence = right.occurrences[0];
  if (!leftOccurrence || !rightOccurrence) return "unknown";
  return [temporalKind(leftOccurrence), temporalKind(rightOccurrence)].sort().join("-vs-");
}

function temporalKind(occurrence: EventOccurrence): "timed" | "date" | "date-range" {
  if (occurrence.kind === "timed") return "timed";
  return occurrence.endDate !== undefined ? "date-range" : "date";
}
