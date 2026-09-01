import { sql } from "drizzle-orm";
import type { Database } from "../client.js";
import type { NormalizedPair } from "./pair.js";

const TIME_ZONE = "America/Sao_Paulo";

// Blocking is recall-oriented, not the final matching decision (section 8): it must be more
// permissive than the engine's own thresholds, or a real duplicate never even reaches
// assessDuplicate. Reuses the same local-date-range technique as discovery
// (packages/database/src/discovery/discover-events.ts) — a timed occurrence's relevant date
// range is its start (and end, if any) converted to the local date in America/Sao_Paulo; a
// date-only occurrence's range is its own start_date/end_date, exactly as ADR-0014 intends.
const LOCAL_START_DATE = (alias: string) => sql.raw(`(CASE WHEN ${alias}.temporal_kind = 'timed'
  THEN (${alias}.starts_at AT TIME ZONE '${TIME_ZONE}')::date
  ELSE ${alias}.start_date END)`);
const LOCAL_END_DATE = (alias: string) => sql.raw(`(CASE WHEN ${alias}.temporal_kind = 'timed'
  THEN (COALESCE(${alias}.ends_at, ${alias}.starts_at) AT TIME ZONE '${TIME_ZONE}')::date
  ELSE COALESCE(${alias}.end_date, ${alias}.start_date) END)`);

// Deliberately low/generous compared to any final-matching threshold in @cult/deduplication —
// blocking's only job is to not miss a real duplicate (section 7/8). Combines whole-string
// similarity with word_similarity (better recall for titles that differ mainly by a suffix —
// see the M7 discovery README on why word_similarity beats similarity() for that case).
const TITLE_BLOCKING_THRESHOLD = 0.15;

interface CandidateRow extends Record<string, unknown> {
  readonly left_id: string;
  readonly right_id: string;
}

// SQL finds CANDIDATES only — it never decides identity (section 7/9). Every field the M6/
// M6.1 engine actually reasons about (title/venue/temporal/geo/performer similarity, routing,
// eligibility) lives in exactly one place, @cult/deduplication, and is never reimplemented
// here.
export async function findCandidatePairs(db: Database): Promise<readonly NormalizedPair[]> {
  const result = await db.execute<CandidateRow>(sql`
    SELECT DISTINCT LEAST(e1.id, e2.id) AS left_id, GREATEST(e1.id, e2.id) AS right_id
    FROM events e1
    JOIN events e2 ON e1.id < e2.id
    WHERE e1.status = 'scheduled' AND e2.status = 'scheduled'
      -- Cross-source only (section 6) — same-origin duplicates are a different problem.
      AND NOT EXISTS (
        SELECT 1 FROM event_sources es1
        JOIN event_sources es2 ON es1.source_id = es2.source_id
        WHERE es1.event_id = e1.id AND es2.event_id = e2.id
      )
      -- Permissive title recall (section 7/8).
      AND GREATEST(similarity(e1.title, e2.title), word_similarity(e1.title, e2.title)) > ${TITLE_BLOCKING_THRESHOLD}
      -- Any occurrence pair overlapping is enough (mirrors discovery's "any occurrence"
      -- multi-occurrence handling, M7 section 24).
      AND EXISTS (
        SELECT 1
        FROM event_occurrences o1
        JOIN event_occurrences o2 ON true
        WHERE o1.event_id = e1.id AND o2.event_id = e2.id
          AND ${LOCAL_START_DATE("o1")} <= ${LOCAL_END_DATE("o2")}
          AND ${LOCAL_START_DATE("o2")} <= ${LOCAL_END_DATE("o1")}
      )
  `);

  return result.rows.map((row) => ({ leftEventId: row.left_id, rightEventId: row.right_id }));
}
