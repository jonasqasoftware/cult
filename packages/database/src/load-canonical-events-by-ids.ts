import { inArray } from "drizzle-orm";
import type { CanonicalEvent } from "@cult/domain";
import { assembleCanonicalEvent } from "./canonical-event-repository.js";
import { eventOccurrences, events, eventSources, venues } from "./schema.js";
import type { Database } from "./client.js";

// M7 (section 50 — avoid N+1): loads N events in a fixed 4 queries total (events, venues,
// occurrences, sources — each a single `WHERE id IN (...)`), instead of loadCanonicalEvent's
// 1-event-at-a-time 4-queries-per-event pattern. Used by discovery, which already knows the
// exact set of matching event ids from its own ranking query before any full event data is
// loaded. Returned order matches the input `ids` order (the caller's ranking), skipping any
// id no longer present.
export async function loadCanonicalEventsByIds(
  db: Database,
  ids: readonly string[],
): Promise<CanonicalEvent[]> {
  if (ids.length === 0) return [];

  const [eventRows, occurrenceRows, sourceRows] = await Promise.all([
    db.select().from(events).where(inArray(events.id, ids)),
    db.select().from(eventOccurrences).where(inArray(eventOccurrences.eventId, ids)),
    db.select().from(eventSources).where(inArray(eventSources.eventId, ids)),
  ]);

  const venueIds = [...new Set(eventRows.map((row) => row.venueId).filter((id): id is string => id !== null))];
  const venueRows = venueIds.length > 0 ? await db.select().from(venues).where(inArray(venues.id, venueIds)) : [];

  const venueById = new Map(venueRows.map((row) => [row.id, row]));
  const occurrencesByEventId = groupByEventId(occurrenceRows);
  const sourcesByEventId = groupByEventId(sourceRows);
  const eventRowById = new Map(eventRows.map((row) => [row.id, row]));

  const loaded: CanonicalEvent[] = [];
  for (const id of ids) {
    const eventRow = eventRowById.get(id);
    if (!eventRow) continue;
    loaded.push(
      assembleCanonicalEvent(
        eventRow,
        eventRow.venueId ? venueById.get(eventRow.venueId) : undefined,
        occurrencesByEventId.get(id) ?? [],
        sourcesByEventId.get(id) ?? [],
      ),
    );
  }
  return loaded;
}

function groupByEventId<T extends { eventId: string }>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.eventId);
    if (existing) {
      existing.push(row);
    } else {
      grouped.set(row.eventId, [row]);
    }
  }
  return grouped;
}
