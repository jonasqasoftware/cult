// `pnpm dedup:evaluate:calibration|holdout|all` — runs the deduplication engine over one
// partition of the golden dataset and reports aggregate + per-case metrics. This CLI (not the
// engine) is allowed to compare against identityTruth/expectedRouting/rationale, since the
// engine itself never receives them (see engine/assess.ts and README.md "Zero data leakage").
import { loadDedupCases } from "../golden-dataset/loader.js";
import { evaluateCases, selectPartition, type PartitionName } from "../evaluation/evaluate.js";
import type { EvaluationMetrics } from "../evaluation/metrics.js";

const PARTITION_NAMES: readonly PartitionName[] = ["calibration", "holdout", "all"];

function parsePartition(argv: readonly string[]): PartitionName {
  const requested = argv[2];
  if (requested && (PARTITION_NAMES as readonly string[]).includes(requested)) {
    return requested as PartitionName;
  }
  throw new Error(`usage: dedup-evaluate <${PARTITION_NAMES.join("|")}>`);
}

const partition = parsePartition(process.argv);
const cases = selectPartition(loadDedupCases(), partition);
const { results, metrics } = evaluateCases(cases);

console.log(`partition: ${partition} (${cases.length} cases)\n`);

printMetrics(metrics);

if (metrics.incorrectCases.length > 0) {
  console.log(`\nincorrect cases (${metrics.incorrectCases.length}):`);
  for (const incorrect of metrics.incorrectCases) {
    console.log(`  ${incorrect.caseId}`);
    console.log(`    expected: ${incorrect.expectedRouting}  actual: ${incorrect.assessment.routing}`);
    console.log(`    score: ${incorrect.assessment.score.toFixed(3)}`);
    console.log(`    signals: ${JSON.stringify(incorrect.assessment.signals)}`);
    console.log(
      `    conflicts: ${incorrect.assessment.detectedConflicts.length > 0 ? incorrect.assessment.detectedConflicts.join(", ") : "none"}`,
    );
  }
}

console.log("\nsafety gates:");
console.log(`  false auto-merge of known-different: ${metrics.falseAutoMergesOfKnownDifferent} (must be 0)`);
console.log(`  false auto-merge of uncertain: ${metrics.falseAutoMergesOfUncertain} (must be 0)`);
const gdA01 = results.find((r) => r.caseId === "GD-A01");
if (gdA01) {
  console.log(`  GD-A01 routing: ${gdA01.assessment.routing} (must be "review")`);
}

function printMetrics(m: EvaluationMetrics): void {
  console.log(`total cases: ${m.totalCases}`);
  console.log(`routing accuracy: ${(m.routingAccuracy * 100).toFixed(1)}%`);
  console.log(`review rate: ${(m.reviewRate * 100).toFixed(1)}%`);
  console.log(`auto-merge precision: ${formatRate(m.autoMergePrecision)}`);
  console.log(`auto-merge recall: ${formatRate(m.autoMergeRecall)}`);
  console.log(`separate precision: ${formatRate(m.separatePrecision)}`);
  console.log(`false auto-merges: ${m.falseAutoMerges}`);
  console.log(`false separates: ${m.falseSeparates}`);

  console.log("\nconfusion matrix (expected -> actual):");
  for (const [expected, actuals] of Object.entries(m.confusionMatrix)) {
    console.log(`  ${expected}: ${JSON.stringify(actuals)}`);
  }

  console.log("\naccuracy by difficulty:");
  printRecord(m.accuracyByDifficulty);
  console.log("accuracy by truth:");
  printRecord(m.accuracyByTruth);
  console.log("accuracy by temporal pairing:");
  printRecord(m.accuracyByTemporalPairing);
}

function printRecord(record: Record<string, number>): void {
  for (const [key, value] of Object.entries(record)) {
    console.log(`  ${key}: ${(value * 100).toFixed(1)}%`);
  }
}

function formatRate(value: number | null): string {
  return value === null ? "n/a (no predictions of this kind)" : `${(value * 100).toFixed(1)}%`;
}
