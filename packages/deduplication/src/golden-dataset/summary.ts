import type { CanonicalEventFixture, GoldenDataset } from "./types.js";

// Pure statistics about the dataset's shape — zero matching, zero scoring, zero algorithm.
// This exists so the dataset's balance (truth/routing/temporal/tag distribution) can be
// inspected without writing or running any dedup logic.
export interface GoldenDatasetSummary {
  readonly cases: number;
  readonly truth: Record<string, number>;
  readonly routing: Record<string, number>;
  readonly difficulty: Record<string, number>;
  readonly temporalPairs: Record<string, number>;
  readonly tags: Record<string, number>;
  readonly criticalConflicts: Record<string, number>;
}

export function summarizeGoldenDataset(dataset: GoldenDataset): GoldenDatasetSummary {
  const truth: Record<string, number> = {};
  const routing: Record<string, number> = {};
  const difficulty: Record<string, number> = {};
  const temporalPairs: Record<string, number> = {};
  const tags: Record<string, number> = {};
  const criticalConflicts: Record<string, number> = {};

  for (const dedupCase of dataset.cases) {
    increment(truth, dedupCase.identityTruth);
    increment(routing, dedupCase.expectedRouting);
    increment(difficulty, dedupCase.difficulty);

    const pairKind = [temporalKind(dedupCase.left), temporalKind(dedupCase.right)].sort().join("-vs-");
    increment(temporalPairs, pairKind);

    for (const tag of dedupCase.tags) {
      increment(tags, tag);
    }
    for (const conflict of dedupCase.criticalConflicts) {
      increment(criticalConflicts, conflict);
    }
  }

  return {
    cases: dataset.cases.length,
    truth,
    routing,
    difficulty,
    temporalPairs,
    tags,
    criticalConflicts,
  };
}

function temporalKind(fixture: CanonicalEventFixture): "timed" | "date" | "date-range" {
  if (fixture.occurrence.kind === "timed") return "timed";
  return fixture.occurrence.endDate !== undefined ? "date-range" : "date";
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}
