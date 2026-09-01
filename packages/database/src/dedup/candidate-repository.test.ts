import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createEventSourceReference,
  createSourceDefinition,
  createTimedEventOccurrence,
} from "@cult/domain";
import { createCanonicalEventRepository } from "../canonical-event-repository.js";
import {
  decideCandidate,
  getCandidateByPair,
  listPendingReview,
  upsertEngineEvaluation,
  type DedupEngineEvaluation,
} from "./candidate-repository.js";
import { normalizePair } from "./pair.js";
import { upsertSource } from "../source-repository.js";
import { connectTestDatabase, truncateAllTables } from "../test-support.js";

const connection = connectTestDatabase();
const repository = createCanonicalEventRepository(connection.db);

const testSource = createSourceDefinition({
  id: "test-source",
  name: "Test Source",
  type: "api",
  enabled: true,
  pollingIntervalMinutes: 30,
  authorityScore: 0.5,
  commercialUse: "unknown",
  connector: "test-connector",
});

beforeEach(async () => {
  await truncateAllTables(connection);
  await upsertSource(connection.db, testSource);
});

afterAll(async () => {
  await connection.close();
});

function makeEvent(id: string) {
  return createCanonicalEvent({
    id,
    slug: id,
    title: `Event ${id}`,
    status: "scheduled",
    occurrences: [
      createTimedEventOccurrence({ id: `${id}-occ`, eventId: id, startsAt: new Date("2026-09-10T20:00:00-03:00"), status: "scheduled" }),
    ],
    sources: [
      createEventSourceReference({
        sourceId: testSource.id,
        externalId: id,
        url: `https://example.org/${id}`,
        firstSeenAt: new Date("2026-01-01T00:00:00Z"),
        lastSeenAt: new Date("2026-01-01T00:00:00Z"),
        confidence: 0.5,
      }),
    ],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

function evaluation(overrides: Partial<DedupEngineEvaluation> = {}): DedupEngineEvaluation {
  const pair = normalizePair("evt-a", "evt-b");
  return {
    leftEventId: pair.leftEventId,
    rightEventId: pair.rightEventId,
    score: 0.97,
    routing: "auto_merge",
    signals: { title: 1, temporal: 1 },
    conflicts: [],
    autoMergeEligible: true,
    blockers: [],
    ...overrides,
  };
}

describe("upsertEngineEvaluation — routing to status mapping", () => {
  it("maps auto_merge to auto_approved", async () => {
    await repository.save(makeEvent("evt-a"));
    await repository.save(makeEvent("evt-b"));
    await upsertEngineEvaluation(connection.db, evaluation({ routing: "auto_merge" }), new Date());
    const row = await getCandidateByPair(connection.db, "evt-a", "evt-b");
    expect(row?.status).toBe("auto_approved");
    expect(row?.decisionSource).toBe("engine");
  });

  it("maps review to pending_review", async () => {
    await repository.save(makeEvent("evt-a"));
    await repository.save(makeEvent("evt-b"));
    await upsertEngineEvaluation(connection.db, evaluation({ routing: "review", score: 0.85 }), new Date());
    const row = await getCandidateByPair(connection.db, "evt-a", "evt-b");
    expect(row?.status).toBe("pending_review");
  });

  it("maps separate to separate", async () => {
    await repository.save(makeEvent("evt-a"));
    await repository.save(makeEvent("evt-b"));
    await upsertEngineEvaluation(connection.db, evaluation({ routing: "separate", score: 0.2 }), new Date());
    const row = await getCandidateByPair(connection.db, "evt-a", "evt-b");
    expect(row?.status).toBe("separate");
  });
});

describe("upsertEngineEvaluation — idempotency", () => {
  it("running the same evaluation twice does not create a duplicate row", async () => {
    await repository.save(makeEvent("evt-a"));
    await repository.save(makeEvent("evt-b"));
    const first = await upsertEngineEvaluation(connection.db, evaluation(), new Date());
    const second = await upsertEngineEvaluation(connection.db, evaluation(), new Date());
    expect(first).toBe("created");
    expect(second).toBe("updated");

    const row = await getCandidateByPair(connection.db, "evt-a", "evt-b");
    expect(row).not.toBeNull();
  });

  it("is unaffected by which order the pair is queried in (A,B vs B,A)", async () => {
    await repository.save(makeEvent("evt-a"));
    await repository.save(makeEvent("evt-b"));
    await upsertEngineEvaluation(connection.db, evaluation(), new Date());
    const forward = await getCandidateByPair(connection.db, "evt-a", "evt-b");
    const backward = await getCandidateByPair(connection.db, "evt-b", "evt-a");
    expect(forward?.id).toBe(backward?.id);
  });
});

describe("upsertEngineEvaluation — human decision precedence", () => {
  it("does not overwrite a confirmed_same decision with a subsequent engine evaluation", async () => {
    await repository.save(makeEvent("evt-a"));
    await repository.save(makeEvent("evt-b"));
    await upsertEngineEvaluation(connection.db, evaluation({ routing: "review", score: 0.85 }), new Date());
    const candidate = await getCandidateByPair(connection.db, "evt-a", "evt-b");
    await decideCandidate(connection.db, candidate!.id, "confirmed_same", new Date());

    // A later scan re-evaluates and would otherwise route this to "separate".
    await upsertEngineEvaluation(connection.db, evaluation({ routing: "separate", score: 0.1 }), new Date());

    const row = await getCandidateByPair(connection.db, "evt-a", "evt-b");
    expect(row?.status).toBe("confirmed_same");
    expect(row?.decisionSource).toBe("human");
  });

  it("still refreshes score/signals/evaluatedAt on a human-decided row, without touching the decision", async () => {
    await repository.save(makeEvent("evt-a"));
    await repository.save(makeEvent("evt-b"));
    await upsertEngineEvaluation(connection.db, evaluation({ score: 0.85, routing: "review" }), new Date());
    const candidate = await getCandidateByPair(connection.db, "evt-a", "evt-b");
    await decideCandidate(connection.db, candidate!.id, "confirmed_different", new Date());

    await upsertEngineEvaluation(connection.db, evaluation({ score: 0.42, routing: "separate" }), new Date());

    const row = await getCandidateByPair(connection.db, "evt-a", "evt-b");
    expect(row?.status).toBe("confirmed_different");
    expect(row?.score).toBeCloseTo(0.42);
  });
});

describe("listPendingReview", () => {
  it("lists only pending_review candidates", async () => {
    await repository.save(makeEvent("evt-a"));
    await repository.save(makeEvent("evt-b"));
    await repository.save(makeEvent("evt-c"));
    await upsertEngineEvaluation(connection.db, { ...evaluation(), routing: "review", score: 0.85 }, new Date());
    await upsertEngineEvaluation(
      connection.db,
      { ...evaluation(), leftEventId: normalizePair("evt-a", "evt-c").leftEventId, rightEventId: normalizePair("evt-a", "evt-c").rightEventId, routing: "separate", score: 0.1 },
      new Date(),
    );

    const pending = await listPendingReview(connection.db);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.status).toBe("pending_review");
  });
});

describe("decideCandidate", () => {
  it("records decidedAt and decision_source=human", async () => {
    await repository.save(makeEvent("evt-a"));
    await repository.save(makeEvent("evt-b"));
    await upsertEngineEvaluation(connection.db, evaluation({ routing: "review", score: 0.85 }), new Date());
    const candidate = await getCandidateByPair(connection.db, "evt-a", "evt-b");

    const now = new Date("2026-02-01T00:00:00Z");
    const decided = await decideCandidate(connection.db, candidate!.id, "confirmed_same", now);
    expect(decided?.decidedAt?.toISOString()).toBe(now.toISOString());
    expect(decided?.decisionSource).toBe("human");
  });
});
