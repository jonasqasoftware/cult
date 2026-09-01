import {
  createCanonicalEvent,
  createEventSourceReference,
  createSourceDefinition,
  createTimedEventOccurrence,
} from "@cult/domain";
import { like } from "drizzle-orm";
import {
  computeSuppressedEventIds,
  createCanonicalEventRepository,
  createDatabaseConnection,
  discoverEvents,
  events,
  normalizePair,
  sources,
  upsertEngineEvaluation,
  upsertSource,
  type Database,
} from "@cult/database";
import { loadAppEnv, loadDotEnvIfPresent } from "@cult/config";

// M10 sections 37/38 — a one-off, manually-run measurement tool, not a CI benchmark and not
// a claimed SLA. Seeds a synthetic dataset with a deliberately larger SUPPRESSING pair count
// than production has today, times computeSuppressedEventIds + discoverEvents, and cleans up
// after itself. Run with: pnpm --filter @cult/worker exec tsx src/commands/perf-check-dedup.ts
const EVENT_COUNT = Number(process.env["PERF_EVENT_COUNT"] ?? 2000);
const SUPPRESSING_PAIR_COUNT = Number(process.env["PERF_SUPPRESSING_PAIRS"] ?? 300);
const PREFIX = "perf-check-dedup";

async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const env = loadAppEnv();
  const connection = createDatabaseConnection({ connectionString: env.databaseUrl });
  const repository = createCanonicalEventRepository(connection.db);
  const now = new Date("2026-01-01T00:00:00Z");

  try {
    await upsertSource(
      connection.db,
      createSourceDefinition({
        id: `${PREFIX}-source`,
        name: "Perf Check Source",
        type: "api",
        enabled: true,
        pollingIntervalMinutes: 60,
        authorityScore: 0.7,
        commercialUse: "restricted",
        connector: `${PREFIX}-connector`,
      }),
    );

    console.log(`Seeding ${EVENT_COUNT} synthetic events...`);
    const ids: string[] = [];
    for (let i = 0; i < EVENT_COUNT; i += 1) {
      const id = `${PREFIX}-evt-${i}`;
      ids.push(id);
      await repository.save(
        createCanonicalEvent({
          id,
          slug: `${PREFIX}-evt-${i}`,
          title: `Synthetic Event ${i}`,
          status: "scheduled",
          occurrences: [
            createTimedEventOccurrence({
              id: `${PREFIX}-occ-${i}`,
              eventId: id,
              startsAt: new Date(now.getTime() + i * 3_600_000),
              status: "scheduled",
            }),
          ],
          sources: [
            createEventSourceReference({
              sourceId: `${PREFIX}-source`,
              url: `https://example.org/${id}`,
              firstSeenAt: now,
              lastSeenAt: now,
              confidence: 0.8,
            }),
          ],
          qualityScore: 0.5,
          rankingScore: 0.5,
          firstSeenAt: now,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    console.log(`Seeding ${SUPPRESSING_PAIR_COUNT} auto_approved dedup candidate pairs...`);
    for (let i = 0; i < SUPPRESSING_PAIR_COUNT; i += 1) {
      const left = ids[i * 2];
      const right = ids[i * 2 + 1];
      if (!left || !right) break;
      const pair = normalizePair(left, right);
      await upsertEngineEvaluation(
        connection.db,
        {
          leftEventId: pair.leftEventId,
          rightEventId: pair.rightEventId,
          score: 0.95,
          routing: "auto_merge",
          signals: { title: 0.95 },
          conflicts: [],
          autoMergeEligible: true,
          blockers: [],
        },
        now,
      );
    }

    const suppressStart = performance.now();
    const suppressed = await computeSuppressedEventIds(connection.db);
    const suppressDuration = performance.now() - suppressStart;
    console.log(`computeSuppressedEventIds: ${suppressDuration.toFixed(1)}ms (${suppressed.size} suppressed ids)`);

    const discoverStart = performance.now();
    await discoverEvents(connection.db, { excludeEventIds: [...suppressed], limit: 12 });
    const discoverDuration = performance.now() - discoverStart;
    console.log(`discoverEvents (with excludeEventIds, limit=12): ${discoverDuration.toFixed(1)}ms`);

    console.log("\nNot a benchmark/SLA — see docs/operations/DEPLOYMENT.md for context.");
  } finally {
    console.log("Cleaning up synthetic data...");
    await cleanup(connection.db);
    await connection.close();
  }
}

async function cleanup(db: Database): Promise<void> {
  await db.delete(events).where(like(events.id, `${PREFIX}-%`));
  await db.delete(sources).where(like(sources.id, `${PREFIX}-%`));
}

main().catch((error: unknown) => {
  console.error("[worker] perf check failed:", error);
  process.exit(1);
});
