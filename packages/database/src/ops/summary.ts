import { eq, sql } from "drizzle-orm";
import { rawEvents, sources } from "../schema.js";
import type { Database } from "../client.js";

export interface SourceHealth {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly lastRawFetchedAt: Date | null;
  readonly rawSuccessCount: number;
  readonly rawFailedCount: number;
  readonly canonicalReferenceCount: number;
}

export interface OpsSummary {
  readonly canonicalEvents: number;
  readonly rawPending: number;
  readonly rawFailed: number;
  readonly dedupPendingReview: number;
  readonly dedupAutoApproved: number;
  readonly dedupConfirmedSame: number;
  readonly dedupConfirmedDifferent: number;
  readonly sources: readonly SourceHealth[];
}

interface CountRow extends Record<string, unknown> {
  readonly count: string;
}

async function scalarCount(db: Database, query: ReturnType<typeof sql>): Promise<number> {
  const result = await db.execute<CountRow>(query);
  return Number(result.rows[0]?.count ?? 0);
}

// M9 section 30/31/32: honestly-available operational metrics only — no invented uptime, no
// dashboard, just real counts a human running this before beta can act on directly. `raw
// success` (per the M9 spec's own vocabulary) means raw_events.processing_status='normalized'.
export async function computeOpsSummary(db: Database): Promise<OpsSummary> {
  const [canonicalEvents, rawPending, rawFailed, dedupPendingReview, dedupAutoApproved, dedupConfirmedSame, dedupConfirmedDifferent] =
    await Promise.all([
      scalarCount(db, sql`SELECT COUNT(*)::text AS count FROM events`),
      scalarCount(db, sql`SELECT COUNT(*)::text AS count FROM raw_events WHERE processing_status = 'pending'`),
      scalarCount(db, sql`SELECT COUNT(*)::text AS count FROM raw_events WHERE processing_status = 'failed'`),
      scalarCount(db, sql`SELECT COUNT(*)::text AS count FROM dedup_candidates WHERE status = 'pending_review'`),
      scalarCount(db, sql`SELECT COUNT(*)::text AS count FROM dedup_candidates WHERE status = 'auto_approved'`),
      scalarCount(db, sql`SELECT COUNT(*)::text AS count FROM dedup_candidates WHERE status = 'confirmed_same'`),
      scalarCount(db, sql`SELECT COUNT(*)::text AS count FROM dedup_candidates WHERE status = 'confirmed_different'`),
    ]);

  const sourceRows = await db.select().from(sources);
  const sourceHealth = await Promise.all(sourceRows.map((source) => computeSourceHealth(db, source)));

  return {
    canonicalEvents,
    rawPending,
    rawFailed,
    dedupPendingReview,
    dedupAutoApproved,
    dedupConfirmedSame,
    dedupConfirmedDifferent,
    sources: sourceHealth,
  };
}

async function computeSourceHealth(db: Database, source: typeof sources.$inferSelect): Promise<SourceHealth> {
  const [lastFetchedRow, successCount, failedCount, canonicalReferenceCount] = await Promise.all([
    db
      .select({ fetchedAt: rawEvents.fetchedAt })
      .from(rawEvents)
      .where(eq(rawEvents.sourceId, source.id))
      .orderBy(sql`${rawEvents.fetchedAt} DESC`)
      .limit(1),
    scalarCount(
      db,
      sql`SELECT COUNT(*)::text AS count FROM raw_events WHERE source_id = ${source.id} AND processing_status = 'normalized'`,
    ),
    scalarCount(
      db,
      sql`SELECT COUNT(*)::text AS count FROM raw_events WHERE source_id = ${source.id} AND processing_status = 'failed'`,
    ),
    scalarCount(db, sql`SELECT COUNT(DISTINCT event_id)::text AS count FROM event_sources WHERE source_id = ${source.id}`),
  ]);

  return {
    id: source.id,
    name: source.name,
    enabled: source.enabled,
    lastRawFetchedAt: lastFetchedRow[0]?.fetchedAt ?? null,
    rawSuccessCount: successCount,
    rawFailedCount: failedCount,
    canonicalReferenceCount,
  };
}
