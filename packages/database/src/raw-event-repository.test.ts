import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createSourceDefinition, type RawSourceEvent } from "@cult/domain";
import { createRawEventRepository } from "./raw-event-repository.js";
import { upsertSource } from "./source-repository.js";
import { connectTestDatabase, truncateAllTables } from "./test-support.js";

const connection = connectTestDatabase();
const repository = createRawEventRepository(connection.db);

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

function makeRawEvent(overrides: Partial<RawSourceEvent> = {}): RawSourceEvent {
  return {
    id: "raw-1",
    sourceId: testSource.id,
    externalId: "ext-1",
    sourceUrl: "https://example.org/e/1",
    payload: { hello: "world" },
    contentHash: "hash-1",
    fetchedAt: new Date("2026-01-01T00:00:00Z"),
    schemaVersion: 1,
    ...overrides,
  };
}

describe("RawEventRepository (PostgreSQL)", () => {
  it("saves and finds a raw event by source + externalId", async () => {
    await repository.save(makeRawEvent());
    const found = await repository.findBySourceAndExternalId(testSource.id, "ext-1");
    expect(found?.id).toBe("raw-1");
    expect(found?.payload).toEqual({ hello: "world" });
  });

  it("returns null when not found", async () => {
    const found = await repository.findBySourceAndExternalId(testSource.id, "missing");
    expect(found).toBeNull();
  });

  it("is idempotent: re-saving the same (sourceId, externalId) updates in place instead of duplicating", async () => {
    await repository.save(makeRawEvent({ contentHash: "hash-1" }));
    await repository.save(
      makeRawEvent({ id: "raw-1-again", contentHash: "hash-2", payload: { updated: true } }),
    );

    const found = await repository.findBySourceAndExternalId(testSource.id, "ext-1");
    expect(found?.contentHash).toBe("hash-2");
    expect(found?.payload).toEqual({ updated: true });
    expect(found?.id).toBe("raw-1");
  });

  it("marks a processing result by (sourceId, externalId) without throwing", async () => {
    await repository.save(makeRawEvent());
    await expect(
      repository.markProcessingResultByExternalId(testSource.id, "ext-1", "normalized"),
    ).resolves.toBeUndefined();
    await expect(
      repository.markProcessingResultByExternalId(
        testSource.id,
        "ext-1",
        "failed",
        "normalization error",
      ),
    ).resolves.toBeUndefined();
  });
});
