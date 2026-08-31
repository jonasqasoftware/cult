import { asc, sql } from "drizzle-orm";
import type { CanonicalEvent } from "@cult/domain";
import { events } from "./schema.js";
import type { Database } from "./client.js";
import { loadCanonicalEvent } from "./canonical-event-repository.js";

// Deliberately NOT part of CanonicalEventRepositoryPort (M2 keeps that port to
// save/findById/findBySlug only — see docs/product/CLAUDE_CODE_EXECUTION_PLAN.md M2 scope).
// This is a minimal, explicit read query used directly by apps/api to prove the vertical
// slice's read path. Cursor pagination per CLAUDE.md (never deep offset pagination).

export interface ListCanonicalEventsOptions {
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ListCanonicalEventsResult {
  readonly items: readonly CanonicalEvent[];
  readonly nextCursor: string | null;
}

const DEFAULT_LIMIT = 20;

export async function listCanonicalEvents(
  db: Database,
  options: ListCanonicalEventsOptions = {},
): Promise<ListCanonicalEventsResult> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const cursorCondition = options.cursor ? buildCursorCondition(options.cursor) : undefined;

  const rows = await db
    .select({ id: events.id, createdAt: events.createdAt })
    .from(events)
    .where(cursorCondition)
    .orderBy(asc(events.createdAt), asc(events.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;

  const loaded = await Promise.all(pageRows.map((row) => loadCanonicalEvent(db, sql`${events.id} = ${row.id}`)));
  const items = loaded.filter((event): event is CanonicalEvent => event !== null);

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasMore && lastRow ? encodeCursor(lastRow.createdAt, lastRow.id) : null;

  return { items, nextCursor };
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, "utf8").toString("base64url");
}

function buildCursorCondition(cursor: string) {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, "base64url").toString("utf8");
  } catch {
    throw new Error("Invalid cursor");
  }
  const separatorIndex = decoded.indexOf("|");
  if (separatorIndex === -1) {
    throw new Error("Invalid cursor");
  }
  const createdAtIso = decoded.slice(0, separatorIndex);
  const id = decoded.slice(separatorIndex + 1);
  const createdAt = new Date(createdAtIso);
  if (Number.isNaN(createdAt.getTime()) || id.length === 0) {
    throw new Error("Invalid cursor");
  }
  return sql`(${events.createdAt}, ${events.id}) > (${createdAt.toISOString()}, ${id})`;
}
