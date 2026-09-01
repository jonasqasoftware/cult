import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createEventSourceReference,
  createSourceDefinition,
  createTimedEventOccurrence,
} from "@cult/domain";
import { createCanonicalEventRepository } from "./canonical-event-repository.js";
import { listCategoryIds } from "./list-category-ids.js";
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

function makeEvent(id: string, categoryId?: string) {
  return createCanonicalEvent({
    id,
    slug: id,
    title: `Event ${id}`,
    status: "scheduled",
    occurrences: [
      createTimedEventOccurrence({
        id: `${id}-occ`,
        eventId: id,
        startsAt: new Date("2026-09-01T22:00:00-03:00"),
        status: "scheduled",
      }),
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
    ...(categoryId !== undefined ? { categoryId } : {}),
  });
}

describe("listCategoryIds", () => {
  it("returns an empty array when there are no events", async () => {
    const result = await listCategoryIds(connection.db);
    expect(result).toEqual([]);
  });

  it("returns a single category", async () => {
    await repository.save(makeEvent("evt-a", "music"));
    const result = await listCategoryIds(connection.db);
    expect(result).toEqual(["music"]);
  });

  it("returns each distinct category once, even if several events share it", async () => {
    await repository.save(makeEvent("evt-a", "music"));
    await repository.save(makeEvent("evt-b", "music"));
    await repository.save(makeEvent("evt-c", "music"));
    const result = await listCategoryIds(connection.db);
    expect(result).toEqual(["music"]);
  });

  it("returns multiple categories in deterministic (alphabetical) order", async () => {
    await repository.save(makeEvent("evt-a", "theater"));
    await repository.save(makeEvent("evt-b", "music"));
    await repository.save(makeEvent("evt-c", "art"));
    const result = await listCategoryIds(connection.db);
    expect(result).toEqual(["art", "music", "theater"]);
  });

  it("excludes events with no category", async () => {
    await repository.save(makeEvent("evt-a", "music"));
    await repository.save(makeEvent("evt-b"));
    const result = await listCategoryIds(connection.db);
    expect(result).toEqual(["music"]);
  });
});
