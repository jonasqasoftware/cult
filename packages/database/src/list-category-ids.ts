import { asc, isNotNull } from "drizzle-orm";
import { events } from "./schema.js";
import type { Database } from "./client.js";

// M7.1: backs GET /v1/categories. No categories table exists (CLAUDE.md: "No categories
// table in M2 — free-text id derived from the provider's classification") — this queries the
// distinct, real category ids actually present on CanonicalEvents, never a hardcoded
// taxonomy. Deterministic (alphabetical) order, not physical row order.
export async function listCategoryIds(db: Database): Promise<readonly string[]> {
  const rows = await db
    .selectDistinct({ categoryId: events.categoryId })
    .from(events)
    .where(isNotNull(events.categoryId))
    .orderBy(asc(events.categoryId));

  return rows.map((row) => row.categoryId as string);
}
