import {
  createDatabaseConnection,
  findCandidatePairs,
  loadCanonicalEventsByIds,
  upsertEngineEvaluation,
} from "@cult/database";
import { assessDuplicate } from "@cult/deduplication";

export interface DedupScanSummary {
  readonly evaluated: number;
  readonly autoMerge: number;
  readonly review: number;
  readonly separate: number;
  readonly created: number;
  readonly updated: number;
}

// M9 section 9/10: SQL (findCandidatePairs) finds candidates; the exact same M6/M6.1 engine
// (assessDuplicate) decides identity — never reimplemented here. This function is the
// composition root: candidate pairs -> load events (batched, not one query per pair) ->
// assessDuplicate -> upsertEngineEvaluation -> summary.
export async function runDedupScan(databaseUrl: string, now: Date = new Date()): Promise<DedupScanSummary> {
  const connection = createDatabaseConnection({ connectionString: databaseUrl });
  try {
    const pairs = await findCandidatePairs(connection.db);
    const eventIds = [...new Set(pairs.flatMap((pair) => [pair.leftEventId, pair.rightEventId]))];
    const events = await loadCanonicalEventsByIds(connection.db, eventIds);
    const eventById = new Map(events.map((event) => [event.id, event]));

    let autoMerge = 0;
    let review = 0;
    let separate = 0;
    let created = 0;
    let updated = 0;

    for (const pair of pairs) {
      const left = eventById.get(pair.leftEventId);
      const right = eventById.get(pair.rightEventId);
      if (!left || !right) continue; // an event referenced by a candidate disappeared mid-scan

      const assessment = assessDuplicate(left, right);
      if (assessment.routing === "auto_merge") autoMerge += 1;
      else if (assessment.routing === "review") review += 1;
      else separate += 1;

      const outcome = await upsertEngineEvaluation(
        connection.db,
        {
          leftEventId: pair.leftEventId,
          rightEventId: pair.rightEventId,
          score: assessment.score,
          routing: assessment.routing,
          signals: assessment.signals as unknown as Record<string, number>,
          conflicts: assessment.detectedConflicts,
          autoMergeEligible: assessment.autoMergeEligible,
          blockers: assessment.autoMergeBlockers,
        },
        now,
      );
      if (outcome === "created") created += 1;
      else updated += 1;
    }

    return { evaluated: pairs.length, autoMerge, review, separate, created, updated };
  } finally {
    await connection.close();
  }
}
