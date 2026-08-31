import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createEventOccurrence,
  createEventSourceReference,
  createSourceDefinition,
  createVenue,
} from "@cult/domain";
import { createCanonicalEventRepository } from "./canonical-event-repository.js";
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

function makeEvent() {
  const occurrence = createEventOccurrence({
    id: "occ-1",
    eventId: "evt-1",
    startsAt: new Date("2026-09-01T22:00:00-03:00"),
    status: "scheduled",
  });
  const source = createEventSourceReference({
    sourceId: testSource.id,
    externalId: "ext-1",
    url: "https://example.org/e/1",
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-02T00:00:00Z"),
    confidence: 0.8,
  });
  const venue = createVenue({
    id: "venue-1",
    name: "Teatro São Pedro",
    city: "Porto Alegre",
    state: "RS",
    latitude: -30.03,
    longitude: -51.23,
  });
  return createCanonicalEvent({
    id: "evt-1",
    slug: "show-exemplo",
    title: "Show Exemplo",
    status: "scheduled",
    occurrences: [occurrence],
    sources: [source],
    venue,
    performers: [{ id: "perf-1", name: "Artista X" }],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-02T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  });
}

describe("CanonicalEventRepository (PostgreSQL)", () => {
  it("saves and finds an event by id", async () => {
    const event = makeEvent();
    await repository.save(event);
    const found = await repository.findById(event.id);
    expect(found?.title).toBe("Show Exemplo");
    expect(found?.venue?.name).toBe("Teatro São Pedro");
    expect(found?.occurrences).toHaveLength(1);
    expect(found?.sources).toHaveLength(1);
    expect(found?.performers).toEqual([{ id: "perf-1", name: "Artista X" }]);
  });

  it("finds an event by slug", async () => {
    const event = makeEvent();
    await repository.save(event);
    const found = await repository.findBySlug("show-exemplo");
    expect(found?.id).toBe(event.id);
  });

  it("returns null when not found", async () => {
    expect(await repository.findById("missing")).toBeNull();
    expect(await repository.findBySlug("missing")).toBeNull();
  });

  it("save() is an upsert: re-saving replaces occurrences and status", async () => {
    const event = makeEvent();
    await repository.save(event);

    const updatedOccurrence = createEventOccurrence({
      id: "occ-2",
      eventId: event.id,
      startsAt: new Date("2026-09-02T22:00:00-03:00"),
      status: "rescheduled",
    });
    const updated = createCanonicalEvent({
      ...event,
      status: "rescheduled",
      occurrences: [updatedOccurrence],
      updatedAt: new Date("2026-01-03T00:00:00Z"),
    });
    await repository.save(updated);

    const found = await repository.findById(event.id);
    expect(found?.status).toBe("rescheduled");
    expect(found?.occurrences).toHaveLength(1);
    expect(found?.occurrences[0]?.id).toBe("occ-2");
  });
});
