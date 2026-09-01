import type { EventSourcePort, SourceDefinition } from "@cult/domain";
import type { NormalizationResult } from "@cult/canonical-events";
import {
  createCanonicalEventRepository,
  createDatabaseConnection,
  createRawEventRepository,
  upsertSource,
} from "@cult/database";

export interface IngestionSummary {
  readonly source: string;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly discovered: number;
  readonly rawSaved: number;
  readonly normalized: number;
  readonly canonicalSaved: number;
  readonly failed: number;
}

// The composition root shared by every connector's ingestion pipeline:
// adapter.collect() -> save raw -> normalize -> save canonical.
// Provider-specific behavior is entirely captured by the three arguments (adapter, the
// normalize function, and its SourceDefinition) — this function itself knows nothing about
// Ticketmaster, Destino POA, or any future source. Extracted in M3 once a second provider
// needed the exact same pipeline.
export async function runIngestion<TPayload>(
  adapter: EventSourcePort,
  normalize: (payload: TPayload, context: { sourceId: string; now: Date }) => NormalizationResult,
  sourceDefinition: SourceDefinition,
  databaseUrl: string,
): Promise<IngestionSummary> {
  const startedAt = new Date();
  const connection = createDatabaseConnection({ connectionString: databaseUrl });
  const rawEventRepository = createRawEventRepository(connection.db);
  const canonicalEventRepository = createCanonicalEventRepository(connection.db);

  let discovered = 0;
  let rawSaved = 0;
  let normalized = 0;
  let canonicalSaved = 0;
  let failed = 0;

  try {
    await upsertSource(connection.db, sourceDefinition);

    for await (const rawEvent of adapter.collect({})) {
      discovered += 1;
      await rawEventRepository.save(rawEvent);
      rawSaved += 1;

      const normalization = normalize(rawEvent.payload as TPayload, {
        sourceId: adapter.sourceId,
        now: new Date(),
      });

      if (!normalization.ok) {
        failed += 1;
        if (rawEvent.externalId) {
          await rawEventRepository.markProcessingResultByExternalId(
            adapter.sourceId,
            rawEvent.externalId,
            "failed",
            normalization.reason,
          );
        }
        continue;
      }

      normalized += 1;
      await canonicalEventRepository.save(normalization.event);
      canonicalSaved += 1;
      if (rawEvent.externalId) {
        await rawEventRepository.markProcessingResultByExternalId(
          adapter.sourceId,
          rawEvent.externalId,
          "normalized",
        );
      }
    }
  } finally {
    await connection.close();
  }

  return {
    source: adapter.sourceId,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    discovered,
    rawSaved,
    normalized,
    canonicalSaved,
    failed,
  };
}
