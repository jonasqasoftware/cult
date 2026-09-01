import { afterAll, describe, beforeEach, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createDateOnlyEventOccurrence,
  createTimedEventOccurrence,
  createEventSourceReference,
  createSourceDefinition,
  type EventOccurrence,
} from "@cult/domain";
import { createCanonicalEventRepository, createDatabaseConnection, upsertSource } from "@cult/database";
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

function makeEvent(id: string, occurrence?: EventOccurrence) {
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
    occurrences: [
      occurrence ??
        createTimedEventOccurrence({
          id: `${id}-occ`,
          eventId: id,
          startsAt: new Date("2026-09-01T22:00:00-03:00"),
          status: "scheduled",
        }),
    ],
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

describe("GET /ready (database unreachable)", () => {
  it("returns a generic problem+json 503 without leaking the internal DB error", async () => {
    const unreachableConnectionString = "postgresql://cult:cult@127.0.0.1:1/nonexistent";
    const unreachableConnection = createDatabaseConnection({
      connectionString: unreachableConnectionString,
    });
    const unreachableApp = buildServer({ db: unreachableConnection.db });

    try {
      const response = await unreachableApp.inject({ method: "GET", url: "/ready" });
      expect(response.statusCode).toBe(503);
      expect(response.headers["content-type"]).toContain("application/problem+json");
      const body = response.json();
      expect(body.detail).toBe("A required dependency is unavailable");
      expect(body.detail).not.toContain("127.0.0.1");
      expect(JSON.stringify(body)).not.toContain(unreachableConnectionString);
    } finally {
      await unreachableApp.close();
      await unreachableConnection.close();
    }
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

// M4 / ADR-0014: EventOccurrence is a discriminated union — confirm the API serializes both
// kinds honestly (never a fabricated "T00:00:00" for a date-only occurrence).
describe("GET /v1/events/:slug — occurrence kinds", () => {
  it("serializes a timed occurrence", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    const occurrence = createTimedEventOccurrence({
      id: "evt-timed-occ",
      eventId: "evt-timed",
      startsAt: new Date("2026-09-01T22:00:00-03:00"),
      status: "scheduled",
    });
    await repository.save(makeEvent("evt-timed", occurrence));

    const response = await app.inject({ method: "GET", url: "/v1/events/evt-timed" });
    expect(response.statusCode).toBe(200);
    expect(response.json().occurrences[0]).toEqual({
      kind: "timed",
      starts_at: "2026-09-02T01:00:00.000Z",
      ends_at: null,
      timezone: "America/Sao_Paulo",
      status: "scheduled",
    });
  });

  it("serializes a date-only single-day occurrence", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    const occurrence = createDateOnlyEventOccurrence({
      id: "evt-date-occ",
      eventId: "evt-date",
      startDate: "2026-10-10",
      status: "scheduled",
    });
    await repository.save(makeEvent("evt-date", occurrence));

    const response = await app.inject({ method: "GET", url: "/v1/events/evt-date" });
    expect(response.statusCode).toBe(200);
    expect(response.json().occurrences[0]).toEqual({
      kind: "date",
      start_date: "2026-10-10",
      end_date: null,
      timezone: "America/Sao_Paulo",
      status: "scheduled",
    });
  });

  it("serializes a date-only range occurrence", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    const occurrence = createDateOnlyEventOccurrence({
      id: "evt-range-occ",
      eventId: "evt-range",
      startDate: "2026-08-29",
      endDate: "2026-09-20",
      status: "scheduled",
    });
    await repository.save(makeEvent("evt-range", occurrence));

    const response = await app.inject({ method: "GET", url: "/v1/events/evt-range" });
    expect(response.statusCode).toBe(200);
    expect(response.json().occurrences[0]).toEqual({
      kind: "date",
      start_date: "2026-08-29",
      end_date: "2026-09-20",
      timezone: "America/Sao_Paulo",
      status: "scheduled",
    });
  });
});
