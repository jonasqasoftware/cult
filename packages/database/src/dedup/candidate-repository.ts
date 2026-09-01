import { and, eq } from "drizzle-orm";
import { dedupCandidates } from "../schema.js";
import type { Database } from "../client.js";
import { normalizePair } from "./pair.js";

export type EngineRouting = "auto_merge" | "review" | "separate";
export type DedupStatus = "pending_review" | "auto_approved" | "separate" | "confirmed_same" | "confirmed_different";
export type DecisionSource = "engine" | "human";

// M9 section 12/13/14: the engine's own routing maps directly to a status — "auto_merge"
// means "safe to suppress duplicate presentation" (never a physical merge), "review" means
// both events stay independently visible until a human decides, and "separate" is persisted
// too so a later scan doesn't need to re-evaluate an unchanged pair from scratch.
const ROUTING_TO_STATUS: Record<EngineRouting, DedupStatus> = {
  auto_merge: "auto_approved",
  review: "pending_review",
  separate: "separate",
};

export interface DedupEngineEvaluation {
  readonly leftEventId: string;
  readonly rightEventId: string;
  readonly score: number;
  readonly routing: EngineRouting;
  readonly signals: Record<string, number>;
  readonly conflicts: readonly string[];
  readonly autoMergeEligible: boolean;
  readonly blockers: readonly string[];
}

export interface DedupCandidateRow {
  readonly id: string;
  readonly leftEventId: string;
  readonly rightEventId: string;
  readonly score: number;
  readonly routing: EngineRouting;
  readonly signals: Record<string, number>;
  readonly conflicts: readonly string[];
  readonly autoMergeEligible: boolean;
  readonly blockers: readonly string[];
  readonly status: DedupStatus;
  readonly decisionSource: DecisionSource;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly evaluatedAt: Date;
  readonly decidedAt: Date | null;
}

export type UpsertOutcome = "created" | "updated";

function toRow(row: typeof dedupCandidates.$inferSelect): DedupCandidateRow {
  return {
    id: row.id,
    leftEventId: row.leftEventId,
    rightEventId: row.rightEventId,
    score: row.score,
    routing: row.routing as EngineRouting,
    signals: row.signalsJson,
    conflicts: row.conflictsJson,
    autoMergeEligible: row.autoMergeEligible,
    blockers: row.blockersJson,
    status: row.status as DedupStatus,
    decisionSource: row.decisionSource as DecisionSource,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    evaluatedAt: row.evaluatedAt,
    decidedAt: row.decidedAt,
  };
}

function pairCondition(leftEventId: string, rightEventId: string) {
  return and(eq(dedupCandidates.leftEventId, leftEventId), eq(dedupCandidates.rightEventId, rightEventId));
}

export async function getCandidateByPair(
  db: Database,
  eventIdA: string,
  eventIdB: string,
): Promise<DedupCandidateRow | null> {
  const pair = normalizePair(eventIdA, eventIdB);
  const rows = await db
    .select()
    .from(dedupCandidates)
    .where(pairCondition(pair.leftEventId, pair.rightEventId))
    .limit(1);
  return rows[0] ? toRow(rows[0]) : null;
}

export async function getCandidateById(db: Database, id: string): Promise<DedupCandidateRow | null> {
  const rows = await db.select().from(dedupCandidates).where(eq(dedupCandidates.id, id)).limit(1);
  return rows[0] ? toRow(rows[0]) : null;
}

export async function listPendingReview(db: Database): Promise<readonly DedupCandidateRow[]> {
  const rows = await db.select().from(dedupCandidates).where(eq(dedupCandidates.status, "pending_review"));
  return rows.map(toRow);
}

// The engine's only write path into this table. Section 18: a human decision
// (confirmed_same/confirmed_different) is NEVER downgraded back to an engine-derived status
// by a later scan — but the freshly observed score/signals/conflicts/evaluatedAt ARE still
// recorded, so the audit trail reflects what the engine currently sees without silently
// discarding the human's call.
export async function upsertEngineEvaluation(
  db: Database,
  evaluation: DedupEngineEvaluation,
  now: Date,
): Promise<UpsertOutcome> {
  const pair = normalizePair(evaluation.leftEventId, evaluation.rightEventId);
  if (pair.leftEventId !== evaluation.leftEventId || pair.rightEventId !== evaluation.rightEventId) {
    throw new Error(
      `upsertEngineEvaluation: pair (${evaluation.leftEventId}, ${evaluation.rightEventId}) is not normalized`,
    );
  }

  const existing = await db
    .select({ id: dedupCandidates.id, decisionSource: dedupCandidates.decisionSource })
    .from(dedupCandidates)
    .where(pairCondition(pair.leftEventId, pair.rightEventId))
    .limit(1);

  const observedFields = {
    score: evaluation.score,
    routing: evaluation.routing,
    signalsJson: evaluation.signals,
    conflictsJson: [...evaluation.conflicts],
    autoMergeEligible: evaluation.autoMergeEligible,
    blockersJson: [...evaluation.blockers],
    evaluatedAt: now,
    updatedAt: now,
  };

  if (existing[0]) {
    const isHumanDecided = existing[0].decisionSource === "human";
    await db
      .update(dedupCandidates)
      .set(
        isHumanDecided
          ? observedFields // status/decisionSource untouched — human decision preserved
          : { ...observedFields, status: ROUTING_TO_STATUS[evaluation.routing], decisionSource: "engine" as const },
      )
      .where(eq(dedupCandidates.id, existing[0].id));
    return "updated";
  }

  await db.insert(dedupCandidates).values({
    id: crypto.randomUUID(),
    leftEventId: pair.leftEventId,
    rightEventId: pair.rightEventId,
    ...observedFields,
    status: ROUTING_TO_STATUS[evaluation.routing],
    decisionSource: "engine",
    createdAt: now,
  });
  return "created";
}

// M9 sections 16-17/35: the human review CLI's only write path. No auth/identity exists yet
// (M9 explicitly does not add one) — decision_source records only that a human decided, not
// which one.
export async function decideCandidate(
  db: Database,
  candidateId: string,
  decision: "confirmed_same" | "confirmed_different",
  now: Date,
): Promise<DedupCandidateRow | null> {
  await db
    .update(dedupCandidates)
    .set({ status: decision, decisionSource: "human", decidedAt: now, updatedAt: now })
    .where(eq(dedupCandidates.id, candidateId));
  return getCandidateById(db, candidateId);
}
