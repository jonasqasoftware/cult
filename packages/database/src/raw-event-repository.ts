import { and, eq } from "drizzle-orm";
import type { RawEventRepositoryPort, RawSourceEvent } from "@cult/domain";
import { rawEvents } from "./schema.js";
import type { Database } from "./client.js";

export interface RawEventProcessingResult {
  // Keyed by (sourceId, externalId) rather than the raw event's own id, so callers never
  // need to know whether save() routed to an insert or an idempotent update.
  markProcessingResultByExternalId(
    sourceId: string,
    externalId: string,
    status: "normalized" | "failed",
    error?: string,
  ): Promise<void>;
}

// Idempotency: when (sourceId, externalId) already exists, save() updates that row's
// payload/hash/fetchedAt in place and resets it to "pending" for reprocessing, instead of
// inserting a duplicate. Rows without an externalId always insert — there is no natural key
// to deduplicate on for those.
export function createRawEventRepository(
  db: Database,
): RawEventRepositoryPort & RawEventProcessingResult {
  return {
    async save(event: RawSourceEvent): Promise<void> {
      const existingId = event.externalId
        ? await findExistingId(db, event.sourceId, event.externalId)
        : null;

      if (existingId) {
        await db
          .update(rawEvents)
          .set({
            sourceUrl: event.sourceUrl,
            payloadJson: event.payload,
            contentHash: event.contentHash,
            fetchedAt: event.fetchedAt,
            schemaVersion: event.schemaVersion,
            processingStatus: "pending",
            processingError: null,
          })
          .where(eq(rawEvents.id, existingId));
        return;
      }

      await db.insert(rawEvents).values({
        id: event.id,
        sourceId: event.sourceId,
        externalId: event.externalId ?? null,
        sourceUrl: event.sourceUrl,
        payloadJson: event.payload,
        contentHash: event.contentHash,
        fetchedAt: event.fetchedAt,
        schemaVersion: event.schemaVersion,
      });
    },

    async findBySourceAndExternalId(
      sourceId: string,
      externalId: string,
    ): Promise<RawSourceEvent | null> {
      const rows = await db
        .select()
        .from(rawEvents)
        .where(and(eq(rawEvents.sourceId, sourceId), eq(rawEvents.externalId, externalId)))
        .limit(1);
      const row = rows[0];
      return row ? toDomain(row) : null;
    },

    async markProcessingResultByExternalId(
      sourceId: string,
      externalId: string,
      status: "normalized" | "failed",
      error?: string,
    ): Promise<void> {
      await db
        .update(rawEvents)
        .set({ processingStatus: status, processingError: error ?? null })
        .where(and(eq(rawEvents.sourceId, sourceId), eq(rawEvents.externalId, externalId)));
    },
  };
}

async function findExistingId(
  db: Database,
  sourceId: string,
  externalId: string,
): Promise<string | null> {
  const rows = await db
    .select({ id: rawEvents.id })
    .from(rawEvents)
    .where(and(eq(rawEvents.sourceId, sourceId), eq(rawEvents.externalId, externalId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

function toDomain(row: typeof rawEvents.$inferSelect): RawSourceEvent {
  return {
    id: row.id,
    sourceId: row.sourceId,
    ...(row.externalId !== null ? { externalId: row.externalId } : {}),
    sourceUrl: row.sourceUrl,
    payload: row.payloadJson,
    contentHash: row.contentHash,
    fetchedAt: row.fetchedAt,
    schemaVersion: row.schemaVersion,
  };
}
