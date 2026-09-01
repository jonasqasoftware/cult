import { inArray } from "drizzle-orm";
import { dedupCandidates } from "../schema.js";
import type { Database } from "../client.js";
import { loadCanonicalEventsByIds } from "../load-canonical-events-by-ids.js";
import { selectRepresentative } from "./representative.js";

const SUPPRESSING_STATUSES = ["auto_approved", "confirmed_same"] as const;

// M9 section 19/22: for every pair the product currently treats as "the same event"
// (auto_approved by the engine, or confirmed_same by a human), exactly one side is chosen as
// the public representative (selectRepresentative) and the OTHER side's id is returned here
// for discovery to exclude — never deleted, never merged, still reachable at its own
// /eventos/<slug> (M9 section 23).
//
// Per-pair only: this does not chase transitive clusters (A~B and B~C doesn't imply A~C is
// resolved together) — the fixture/MVP1 dataset has no evidence of 3-way duplicate clusters,
// and doing real clustering is exactly the kind of "field reconciliation" scope M9
// deliberately excludes (section 43).
export async function computeSuppressedEventIds(db: Database): Promise<ReadonlySet<string>> {
  const rows = await db
    .select({ leftEventId: dedupCandidates.leftEventId, rightEventId: dedupCandidates.rightEventId })
    .from(dedupCandidates)
    .where(inArray(dedupCandidates.status, [...SUPPRESSING_STATUSES]));

  if (rows.length === 0) return new Set();

  const eventIds = [...new Set(rows.flatMap((row) => [row.leftEventId, row.rightEventId]))];
  const events = await loadCanonicalEventsByIds(db, eventIds);
  const eventById = new Map(events.map((event) => [event.id, event]));

  const suppressed = new Set<string>();
  for (const row of rows) {
    const left = eventById.get(row.leftEventId);
    const right = eventById.get(row.rightEventId);
    if (!left || !right) continue; // defensive — FK constraints should make this unreachable
    const representative = selectRepresentative(left, right);
    suppressed.add(representative.id === left.id ? right.id : left.id);
  }
  return suppressed;
}
