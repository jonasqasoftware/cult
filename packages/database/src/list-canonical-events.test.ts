import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createTimedEventOccurrence,
  createEventSourceReference,
  createSourceDefinition,
} from "@cult/domain";
import { createCanonicalEventRepository } from "./canonical-event-repository.js";
import { listCanonicalEvents } from "./list-canonical-events.js";
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

function makeEvent(id: string, createdAt: Date) {
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
    firstSeenAt: createdAt,
    lastSeenAt: createdAt,
    confidence: 0.5,
  });
  return createCanonicalEvent({
    id,
    slug: id,
    title: `Event ${id}`,
    status: "scheduled",
    occurrences: [occurrence],
    sources: [source],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: createdAt,
    lastSeenAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  });
}

describe("listCanonicalEvents", () => {
  it("returns an empty page when there are no events", async () => {
    const result = await listCanonicalEvents(connection.db);
    expect(result.items).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });

  it("paginates deterministically with a cursor", async () => {
    await repository.save(makeEvent("evt-a", new Date("2026-01-01T00:00:00Z")));
    await repository.save(makeEvent("evt-b", new Date("2026-01-02T00:00:00Z")));
    await repository.save(makeEvent("evt-c", new Date("2026-01-03T00:00:00Z")));

    const firstPage = await listCanonicalEvents(connection.db, { limit: 2 });
    expect(firstPage.items.map((e) => e.id)).toEqual(["evt-a", "evt-b"]);
    expect(firstPage.nextCursor).not.toBeNull();

    const nextCursor = firstPage.nextCursor;
    if (!nextCursor) throw new Error("expected a nextCursor");
    const secondPage = await listCanonicalEvents(connection.db, { limit: 2, cursor: nextCursor });
    expect(secondPage.items.map((e) => e.id)).toEqual(["evt-c"]);
    expect(secondPage.nextCursor).toBeNull();
  });
});
