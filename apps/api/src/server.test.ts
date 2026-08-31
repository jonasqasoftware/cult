import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createEventOccurrence,
  createEventSourceReference,
  createSourceDefinition,
} from "@cult/domain";
import { createCanonicalEventRepository, upsertSource } from "@cult/database";
import { connectTestDatabase, truncateAllTables } from "@cult/database/test-support";
import { buildServer } from "./server.js";

const connection = connectTestDatabase();
const app = buildServer({ db: connection.db });

const testSource = createSourceDefinition({
  id: "ticketmaster",
  name: "Ticketmaster",
  type: "api",
  enabled: true,
  pollingIntervalMinutes: 60,
  authorityScore: 0.7,
  commercialUse: "restricted",
  connector: "ticketmaster",
});

beforeEach(async () => {
  await truncateAllTables(connection);
  await upsertSource(connection.db, testSource);
});

afterAll(async () => {
  await app.close();
  await connection.close();
});

function makeEvent(id: string) {
  const occurrence = createEventOccurrence({
    id: `${id}-occ`,
    eventId: id,
    startsAt: new Date("2026-09-01T22:00:00-03:00"),
    status: "scheduled",
  });
  const source = createEventSourceReference({
    sourceId: "ticketmaster",
    externalId: id,
    url: `https://example.org/${id}`,
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-01T00:00:00Z"),
    confidence: 0.9,
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
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

describe("apps/api health", () => {
  it("GET /health returns 200 ok", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("GET /ready returns 200 ready when the database is reachable", async () => {
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ready" });
  });
});

describe("GET /v1/events", () => {
  it("returns an empty page when there are no events", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/events" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [], pagination: { next_cursor: null } });
  });

  it("returns a persisted event mapped to the public API shape", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    await repository.save(makeEvent("evt-a"));

    const response = await app.inject({ method: "GET", url: "/v1/events" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].slug).toBe("evt-a");
    expect(body.data[0].sources[0].source_id).toBe("ticketmaster");
    expect(body.data[0].quality_score).toBe(0.5);
  });

  it("returns a problem+json 400 for a filter that is not implemented yet", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/events?category=music" });
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json().type).toBe("/problems/filter-not-implemented");
  });

  it("returns a problem+json 400 for an out-of-range limit", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/events?limit=0" });
    expect(response.statusCode).toBe(400);
    expect(response.json().type).toBe("/problems/invalid-limit");
  });
});

describe("GET /v1/events/:slug", () => {
  it("returns the event by slug", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    await repository.save(makeEvent("evt-b"));

    const response = await app.inject({ method: "GET", url: "/v1/events/evt-b" });
    expect(response.statusCode).toBe(200);
    expect(response.json().slug).toBe("evt-b");
  });

  it("returns a problem+json 404 when the slug does not exist", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/events/missing" });
    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    expect(response.json().type).toBe("/problems/event-not-found");
  });
});
