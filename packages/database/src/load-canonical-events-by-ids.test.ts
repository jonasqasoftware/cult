import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createEventSourceReference,
  createSourceDefinition,
  createTimedEventOccurrence,
  createVenue,
} from "@cult/domain";
import { createCanonicalEventRepository } from "./canonical-event-repository.js";
import { loadCanonicalEventsByIds } from "./load-canonical-events-by-ids.js";
import { upsertSource } from "./source-repository.js";
import { connectTestDatabase, truncateAllTables } from "./test-support.js";

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

function makeEvent(id: string, venue?: ReturnType<typeof createVenue>) {
  const occurrence = createTimedEventOccurrence({
    id: `${id}-occ`,
    eventId: id,
    startsAt: new Date("2026-09-01T22:00:00-03:00"),
    status: "scheduled",
  });
  const source = createEventSourceReference({
    sourceId: testSource.id,
    externalId: id,
    url: `https://example.org/${id}`,
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-01T00:00:00Z"),
    confidence: 0.5,
  });
  return createCanonicalEvent({
    id,
    slug: id,
    title: `Event ${id}`,
    status: "scheduled",
    occurrences: [occurrence],
    ...(venue ? { venue } : {}),
    sources: [source],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

describe("loadCanonicalEventsByIds", () => {
  it("returns an empty array for an empty id list without querying", async () => {
    const result = await loadCanonicalEventsByIds(connection.db, []);
    expect(result).toEqual([]);
  });

  it("loads multiple events, including venue, occurrences and sources, in a bounded number of queries", async () => {
    const venue = createVenue({ id: "v1", name: "Teatro Exemplo", city: "Porto Alegre", state: "RS" });
    await repository.save(makeEvent("evt-a", venue));
    await repository.save(makeEvent("evt-b"));
    await repository.save(makeEvent("evt-c", venue));

    const result = await loadCanonicalEventsByIds(connection.db, ["evt-a", "evt-b", "evt-c"]);
    expect(result).toHaveLength(3);

    const byId = new Map(result.map((e) => [e.id, e]));
    expect(byId.get("evt-a")?.venue?.name).toBe("Teatro Exemplo");
    expect(byId.get("evt-b")?.venue).toBeUndefined();
    expect(byId.get("evt-c")?.venue?.name).toBe("Teatro Exemplo");
    expect(byId.get("evt-a")?.occurrences).toHaveLength(1);
    expect(byId.get("evt-a")?.sources[0]?.sourceId).toBe("test-source");
  });

  it("silently skips ids that don't exist", async () => {
    await repository.save(makeEvent("evt-a"));
    const result = await loadCanonicalEventsByIds(connection.db, ["evt-a", "does-not-exist"]);
    expect(result.map((e) => e.id)).toEqual(["evt-a"]);
  });
});
