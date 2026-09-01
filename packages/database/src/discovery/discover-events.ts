import { sql, type SQL } from "drizzle-orm";
import type { CanonicalEvent, EventStatus } from "@cult/domain";
import type { Database } from "../client.js";
import { loadCanonicalEventsByIds } from "../load-canonical-events-by-ids.js";
import { decodeCursor, encodeCursor, type Cursor } from "./cursor.js";
import type { DateRange } from "./period.js";

const DEFAULT_STATUS: EventStatus = "scheduled";
const TIME_ZONE = "America/Sao_Paulo";

export interface DiscoveryGeoFilter {
  readonly lat: number;
  readonly lng: number;
  readonly radiusMeters: number;
}

// Post-validation query — every field here has already been parsed/checked (dates are real
// calendar dates, lat/lng/radius are in range, cursor already decoded to the right shape).
// apps/api owns turning raw, possibly-invalid query-string values into this (section 34: keep
// SQL out of the route, but validation/Problem-Details mapping is the route's job, not this
// query service's).
export interface DiscoveryQuery {
  readonly q?: string;
  readonly dateRange?: DateRange;
  readonly category?: string;
  readonly free?: boolean;
  readonly status?: EventStatus;
  readonly geo?: DiscoveryGeoFilter;
  readonly cursor?: string;
  readonly limit: number;
  // M9: ids to exclude entirely (dedup presentation suppression, section 22) — applied inside
  // the same WHERE clause as every other filter, so it always takes effect before ORDER
  // BY/LIMIT/cursor pagination, never as an after-the-fact filter on an already-paginated page
  // (section 24).
  readonly excludeEventIds?: readonly string[];
}

export interface DiscoveryResultItem {
  readonly event: CanonicalEvent;
  readonly distanceMeters?: number;
}

export interface DiscoveryResult {
  readonly items: readonly DiscoveryResultItem[];
  readonly nextCursor: string | null;
}

interface CandidateRow extends Record<string, unknown> {
  readonly id: string;
  // The pg driver doesn't always parse this back into a Date — it's produced by a CASE
  // expression mixing a timestamptz column with a computed AT TIME ZONE expression, and
  // node-postgres's wire-protocol type inference doesn't always resolve that to a known
  // timestamptz OID. Always route it through `new Date(...)` before use (see toIso below).
  readonly sort_instant: Date | string;
  readonly distance_meters: number | null;
}

function toIso(value: Date | string): string {
  return new Date(value).toISOString();
}

// The engine's only entry point for Discovery. Pure SQL/data-access: no filtering happens in
// JavaScript (section 35) — the database finds and ranks the matching event ids in one
// statement, and only the resulting page of ids is turned into full CanonicalEvents, in a
// bounded number of queries (section 50) via loadCanonicalEventsByIds.
export async function discoverEvents(db: Database, query: DiscoveryQuery): Promise<DiscoveryResult> {
  const cursor = query.cursor !== undefined ? decodeCursorOrThrow(query.cursor, query.geo !== undefined) : undefined;

  const occurrenceDateCondition = query.dateRange
    ? sql`${localStartDateExpr} <= ${query.dateRange.end} AND ${localEndDateExpr} >= ${query.dateRange.start}`
    : sql`TRUE`;

  const conditions: SQL[] = [sql`e.status = ${query.status ?? DEFAULT_STATUS}`];
  if (query.category !== undefined) {
    conditions.push(sql`e.category_id = ${query.category}`);
  }
  if (query.free !== undefined) {
    conditions.push(sql`(e.price ->> 'free')::boolean IS ${sql.raw(query.free ? "TRUE" : "FALSE")}`);
  }
  if (query.q !== undefined) {
    conditions.push(buildSearchCondition(query.q));
  }
  if (query.excludeEventIds && query.excludeEventIds.length > 0) {
    conditions.push(sql`e.id NOT IN (${sql.join(query.excludeEventIds.map((id) => sql`${id}`), sql`, `)})`);
  }

  let distanceExpr: SQL = sql`NULL::double precision`;
  if (query.geo) {
    const point = sql`ST_SetSRID(ST_MakePoint(${query.geo.lng}, ${query.geo.lat}), 4326)::geography`;
    conditions.push(sql`v.location IS NOT NULL AND ST_DWithin(v.location, ${point}, ${query.geo.radiusMeters})`);
    distanceExpr = sql`ST_Distance(v.location, ${point})`;
  }

  const whereClause = andAll(conditions);
  const cursorCondition = buildCursorCondition(cursor);
  const orderBy = query.geo
    ? sql`ORDER BY distance_meters ASC, sort_instant ASC, id ASC`
    : sql`ORDER BY sort_instant ASC, id ASC`;
  const limitPlusOne = query.limit + 1;

  const result = await db.execute<CandidateRow>(sql`
    WITH matching_occurrences AS (
      SELECT
        eo.event_id AS event_id,
        MIN(${effectiveInstantExpr}) AS sort_instant
      FROM event_occurrences eo
      WHERE ${occurrenceDateCondition}
      GROUP BY eo.event_id
    ),
    candidates AS (
      SELECT
        e.id AS id,
        mo.sort_instant AS sort_instant,
        ${distanceExpr} AS distance_meters
      FROM events e
      JOIN matching_occurrences mo ON mo.event_id = e.id
      LEFT JOIN venues v ON v.id = e.venue_id
      WHERE ${whereClause}
    )
    SELECT id, sort_instant, distance_meters
    FROM candidates
    WHERE ${cursorCondition}
    ${orderBy}
    LIMIT ${limitPlusOne}
  `);

  const rows = result.rows;
  const hasMore = rows.length > query.limit;
  const pageRows = hasMore ? rows.slice(0, query.limit) : rows;

  const events = await loadCanonicalEventsByIds(
    db,
    pageRows.map((row) => row.id),
  );
  const eventById = new Map(events.map((event) => [event.id, event]));

  const items: DiscoveryResultItem[] = [];
  for (const row of pageRows) {
    const event = eventById.get(row.id);
    if (!event) continue; // deleted between the ranking query and the batch load — skip, don't crash
    items.push({
      event,
      ...(row.distance_meters !== null ? { distanceMeters: row.distance_meters } : {}),
    });
  }

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeCursor(
          query.geo
            ? {
                mode: "nearby",
                distanceMeters: lastRow.distance_meters as number,
                sortInstant: toIso(lastRow.sort_instant),
                id: lastRow.id,
              }
            : { mode: "default", sortInstant: toIso(lastRow.sort_instant), id: lastRow.id },
        )
      : null;

  return { items, nextCursor };
}

// A timed occurrence's "effective" start/end for range comparisons is its LOCAL calendar date
// in America/Sao_Paulo (ADR-0014: never treat kind=date as "all day," and symmetrically never
// invent sub-day precision for a timed occurrence's date-range membership either — this is
// purely for "does this occurrence fall on this calendar day/range" purposes, distinct from
// the dedup engine's instant-level timed-vs-timed comparison).
const localStartDateExpr = sql`(CASE WHEN eo.temporal_kind = 'timed'
  THEN (eo.starts_at AT TIME ZONE ${TIME_ZONE})::date
  ELSE eo.start_date END)`;
const localEndDateExpr = sql`(CASE WHEN eo.temporal_kind = 'timed'
  THEN (COALESCE(eo.ends_at, eo.starts_at) AT TIME ZONE ${TIME_ZONE})::date
  ELSE COALESCE(eo.end_date, eo.start_date) END)`;

// Sort key for "próxima ocorrência" ordering (section 21) — a real timestamptz for a timed
// occurrence, or local midnight of the date-only occurrence's start for a date-only one. This
// is ordering-only: it never feeds into the discovery MATCH/filter logic above.
const effectiveInstantExpr = sql`(CASE WHEN eo.temporal_kind = 'timed'
  THEN eo.starts_at
  ELSE (eo.start_date::timestamp AT TIME ZONE ${TIME_ZONE}) END)`;

const WORD_SIMILARITY_THRESHOLD = 0.3;

function buildSearchCondition(term: string): SQL {
  const pattern = `%${term}%`;
  // pg_trgm (already approved infra — ADR-0005) gives fuzzy/accent tolerance. word_similarity
  // (not plain similarity()) finds the best-matching word-length substring of a longer column
  // value and scores against just that — plain similarity() compares the whole strings, which
  // dilutes to near-zero once the title/venue name has several other words (verified: whole-
  // string similarity('Show do João', 'joao') = 0.125, below any sane threshold, while
  // word_similarity('joao', 'Show do João') = 0.4). Not a full-text-search stack, and not a
  // second, hand-rolled fuzzy matcher.
  return sql`(
    e.title ILIKE ${pattern} OR word_similarity(${term}, e.title) > ${WORD_SIMILARITY_THRESHOLD}
    OR (e.description IS NOT NULL AND e.description ILIKE ${pattern})
    OR (v.name IS NOT NULL AND (v.name ILIKE ${pattern} OR word_similarity(${term}, v.name) > ${WORD_SIMILARITY_THRESHOLD}))
    OR e.performers::text ILIKE ${pattern}
  )`;
}

function andAll(conditions: readonly SQL[]): SQL {
  return conditions.reduce<SQL>((acc, condition) => sql`${acc} AND (${condition})`, sql`TRUE`);
}

function buildCursorCondition(cursor: Cursor | undefined): SQL {
  if (!cursor) return sql`TRUE`;
  if (cursor.mode === "nearby") {
    return sql`(distance_meters, sort_instant, id) > (${cursor.distanceMeters}, ${cursor.sortInstant}::timestamptz, ${cursor.id})`;
  }
  return sql`(sort_instant, id) > (${cursor.sortInstant}::timestamptz, ${cursor.id})`;
}

// M7.1: a distinct, identifiable error class — never a generic Error whose .message the
// caller has to pattern-match. apps/api uses `instanceof` to tell "the client sent a bad
// cursor" (400 invalid-cursor) apart from any other failure (500 internal-error), so this
// must never be thrown for anything other than a cursor that fails to decode.
export class InvalidDiscoveryCursorError extends Error {
  constructor() {
    super("Invalid discovery cursor");
    this.name = "InvalidDiscoveryCursorError";
  }
}

function decodeCursorOrThrow(cursor: string, isNearby: boolean): Cursor {
  const result = isNearby ? decodeCursor(cursor, "nearby") : decodeCursor(cursor, "default");
  if (!result.ok) {
    throw new InvalidDiscoveryCursorError();
  }
  return result.value;
}
