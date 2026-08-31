import type { EventSourcePort } from "@cult/domain";
import { normalizeTicketmasterEvent, type TicketmasterEvent } from "@cult/connectors";
import { TICKETMASTER_SOURCE_DEFINITION } from "@cult/config";
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

// The composition root for the Ticketmaster vertical slice:
// adapter.collect() -> save raw -> normalize -> save canonical.
// Works identically for the fixture adapter and the live adapter — only the EventSourcePort
// implementation passed in differs.
export async function runTicketmasterIngestion(
  adapter: EventSourcePort,
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
    await upsertSource(connection.db, TICKETMASTER_SOURCE_DEFINITION);

    for await (const rawEvent of adapter.collect({})) {
      discovered += 1;
      await rawEventRepository.save(rawEvent);
      rawSaved += 1;

      const normalization = normalizeTicketmasterEvent(rawEvent.payload as TicketmasterEvent, {
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
