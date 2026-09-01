import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createEventSourceReference,
  createSourceDefinition,
  createTimedEventOccurrence,
  createVenue,
} from "@cult/domain";
import { createCanonicalEventRepository } from "../canonical-event-repository.js";
import { upsertEngineEvaluation, type DedupEngineEvaluation } from "./candidate-repository.js";
import { normalizePair } from "./pair.js";
import { computeSuppressedEventIds } from "./suppression.js";
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

function eventSource() {
  return createEventSourceReference({
    sourceId: testSource.id,
    url: "https://example.org/e",
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-01T00:00:00Z"),
    confidence: 0.5,
  });
}

function makeEvent(id: string, hasVenue: boolean) {
  return createCanonicalEvent({
    id,
    slug: id,
    title: `Event ${id}`,
    status: "scheduled",
    occurrences: [
      createTimedEventOccurrence({ id: `${id}-occ`, eventId: id, startsAt: new Date("2026-09-10T20:00:00-03:00"), status: "scheduled" }),
    ],
    sources: [eventSource()],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...(hasVenue
      ? { venue: createVenue({ id: `${id}-venue`, name: "Venue", city: "Porto Alegre", state: "RS" }) }
      : {}),
  });
}

async function upsert(routing: DedupEngineEvaluation["routing"], leftId: string, rightId: string) {
  const pair = normalizePair(leftId, rightId);
  await upsertEngineEvaluation(
    connection.db,
    {
      leftEventId: pair.leftEventId,
      rightEventId: pair.rightEventId,
      score: routing === "auto_merge" ? 0.99 : routing === "review" ? 0.85 : 0.2,
      routing,
      signals: { title: 1 },
      conflicts: [],
      autoMergeEligible: routing === "auto_merge",
      blockers: [],
    },
    new Date(),
  );
}

describe("computeSuppressedEventIds", () => {
  it("is empty when there are no candidates at all", async () => {
    const suppressed = await computeSuppressedEventIds(connection.db);
    expect(suppressed.size).toBe(0);
  });

  it("suppresses the non-representative event of an auto_approved pair", async () => {
    await repository.save(makeEvent("evt-plain", false));
    await repository.save(makeEvent("evt-rich", true)); // more complete -> wins representative
    await upsert("auto_merge", "evt-plain", "evt-rich");

    const suppressed = await computeSuppressedEventIds(connection.db);
    expect(suppressed.has("evt-plain")).toBe(true);
    expect(suppressed.has("evt-rich")).toBe(false);
  });

  it("suppresses the non-representative event of a confirmed_same pair", async () => {
    await repository.save(makeEvent("evt-plain", false));
    await repository.save(makeEvent("evt-rich", true));
    await upsert("review", "evt-plain", "evt-rich");
    const { getCandidateByPair, decideCandidate } = await import("./candidate-repository.js");
    const candidate = await getCandidateByPair(connection.db, "evt-plain", "evt-rich");
    await decideCandidate(connection.db, candidate!.id, "confirmed_same", new Date());

    const suppressed = await computeSuppressedEventIds(connection.db);
    expect(suppressed.has("evt-plain")).toBe(true);
  });

  it("does not suppress anything for a pending_review pair", async () => {
    await repository.save(makeEvent("evt-plain", false));
    await repository.save(makeEvent("evt-rich", true));
    await upsert("review", "evt-plain", "evt-rich");

    const suppressed = await computeSuppressedEventIds(connection.db);
    expect(suppressed.size).toBe(0);
  });

  it("does not suppress anything for a separate or confirmed_different pair", async () => {
    await repository.save(makeEvent("evt-plain", false));
    await repository.save(makeEvent("evt-rich", true));
    await upsert("separate", "evt-plain", "evt-rich");

    const suppressed = await computeSuppressedEventIds(connection.db);
    expect(suppressed.size).toBe(0);
  });
});
