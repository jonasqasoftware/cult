import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createEventSourceReference,
  createSourceDefinition,
  createTimedEventOccurrence,
} from "@cult/domain";
import { createCanonicalEventRepository } from "../canonical-event-repository.js";
import { createRawEventRepository } from "../raw-event-repository.js";
import { upsertSource } from "../source-repository.js";
import { connectTestDatabase, truncateAllTables } from "../test-support.js";
import { computeOpsSummary } from "./summary.js";

const connection = connectTestDatabase();
const canonicalRepo = createCanonicalEventRepository(connection.db);
const rawRepo = createRawEventRepository(connection.db);

const source = createSourceDefinition({
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
  await upsertSource(connection.db, source);
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
        sourceId: source.id,
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

describe("computeOpsSummary", () => {
  it("reports zero counts on an empty database (other than the one seeded source)", async () => {
    const summary = await computeOpsSummary(connection.db);
    expect(summary.canonicalEvents).toBe(0);
    expect(summary.rawPending).toBe(0);
    expect(summary.rawFailed).toBe(0);
    expect(summary.dedupPendingReview).toBe(0);
    expect(summary.dedupAutoApproved).toBe(0);
    expect(summary.dedupConfirmedSame).toBe(0);
    expect(summary.dedupConfirmedDifferent).toBe(0);
    expect(summary.sources).toHaveLength(1);
    expect(summary.sources[0]?.id).toBe("test-source");
    expect(summary.sources[0]?.canonicalReferenceCount).toBe(0);
  });

  it("counts canonical events and per-source canonical references", async () => {
    await canonicalRepo.save(makeEvent("evt-a"));
    await canonicalRepo.save(makeEvent("evt-b"));

    const summary = await computeOpsSummary(connection.db);
    expect(summary.canonicalEvents).toBe(2);
    expect(summary.sources[0]?.canonicalReferenceCount).toBe(2);
  });

  it("counts raw events by processing status", async () => {
    await rawRepo.save({
      id: "raw-1",
      sourceId: source.id,
      externalId: "ext-1",
      sourceUrl: "https://example.org/raw-1",
      payload: {},
      contentHash: "hash-1",
      fetchedAt: new Date("2026-01-01T00:00:00Z"),
      schemaVersion: 1,
    });
    await rawRepo.save({
      id: "raw-2",
      sourceId: source.id,
      externalId: "ext-2",
      sourceUrl: "https://example.org/raw-2",
      payload: {},
      contentHash: "hash-2",
      fetchedAt: new Date("2026-01-02T00:00:00Z"),
      schemaVersion: 1,
    });
    await rawRepo.markProcessingResultByExternalId(source.id, "ext-2", "failed", "boom");

    const summary = await computeOpsSummary(connection.db);
    expect(summary.rawPending).toBe(1);
    expect(summary.rawFailed).toBe(1);
    expect(summary.sources[0]?.rawFailedCount).toBe(1);
    expect(summary.sources[0]?.lastRawFetchedAt?.toISOString()).toBe(new Date("2026-01-02T00:00:00Z").toISOString());
  });
});
