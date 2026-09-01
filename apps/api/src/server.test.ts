import { afterAll, describe, beforeEach, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createDateOnlyEventOccurrence,
  createTimedEventOccurrence,
  createEventSourceReference,
  createSourceDefinition,
  createVenue,
  type CanonicalEvent,
  type EventOccurrence,
  type EventPrice,
} from "@cult/domain";
import {
  computeProductSummary,
  createCanonicalEventRepository,
  createDatabaseConnection,
  normalizePair,
  upsertEngineEvaluation,
  upsertSource,
} from "@cult/database";
import { connectTestDatabase, truncateAllTables } from "@cult/database/test-support";
import { buildServer } from "./server.js";

const connection = connectTestDatabase();
// M7 (section 40): a fixed reference clock, never the real one, so period=today/tomorrow/
// weekend assertions in this file are deterministic regardless of when the suite runs.
const NOW = new Date("2026-09-09T12:00:00-03:00"); // Wednesday, 2026-09-09 local
const app = buildServer({ db: connection.db, now: () => NOW });

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

interface MakeEventOverrides {
  readonly title?: string;
  readonly venue?: ReturnType<typeof createVenue>;
  readonly price?: EventPrice;
  readonly status?: CanonicalEvent["status"];
  readonly categoryId?: string;
}

function makeEvent(id: string, occurrence?: EventOccurrence, overrides: MakeEventOverrides = {}) {
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
    title: overrides.title ?? `Event ${id}`,
    status: overrides.status ?? "scheduled",
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
    ...(overrides.venue ? { venue: overrides.venue } : {}),
    ...(overrides.price ? { price: overrides.price } : {}),
    ...(overrides.categoryId !== undefined ? { categoryId: overrides.categoryId } : {}),
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

// M7.1: discoverEvents was wrapped in a single generic catch that turned ANY failure —
// including an unrelated database error — into a 400 invalid-cursor, potentially leaking the
// real error message. Only a cursor that actually fails to decode may produce that response;
// anything else is an internal-error 500 with a generic, public-safe detail.
describe("GET /v1/events — error classification", () => {
  it("classifies an unexpected database error as a generic 500, never leaking the driver message", async () => {
    const unreachableConnectionString = "postgresql://cult:cult@127.0.0.1:1/nonexistent";
    const unreachableConnection = createDatabaseConnection({
      connectionString: unreachableConnectionString,
    });
    const unreachableApp = buildServer({ db: unreachableConnection.db, now: () => NOW });

    try {
      const response = await unreachableApp.inject({ method: "GET", url: "/v1/events" });
      expect(response.statusCode).toBe(500);
      expect(response.headers["content-type"]).toContain("application/problem+json");
      const body = response.json();
      expect(body.type).toBe("/problems/internal-error");
      expect(body.detail).toBe("An unexpected error occurred");
      expect(body.detail).not.toContain("127.0.0.1");
      expect(JSON.stringify(body)).not.toContain(unreachableConnectionString);
      expect(JSON.stringify(body).toLowerCase()).not.toContain("econnrefused");
    } finally {
      await unreachableApp.close();
      await unreachableConnection.close();
    }
  });

  it("still returns 400 invalid-cursor for a garbage cursor, with a generic public detail", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/events?cursor=garbage" });
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");
    const body = response.json();
    expect(body.type).toBe("/problems/invalid-cursor");
    expect(body.detail).toBe("The supplied pagination cursor is invalid");
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

  it("returns a problem+json 400 for an out-of-range limit", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/events?limit=0" });
    expect(response.statusCode).toBe(400);
    expect(response.json().type).toBe("/problems/invalid-limit");
  });
});

// M7 section 42 — real Fastify inject contract tests for every discovery filter.
describe("GET /v1/events — discovery filters (contract tests)", () => {
  it("period=today returns events happening on the injected reference date", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    await repository.save(
      makeEvent(
        "today-evt",
        createTimedEventOccurrence({ id: "today-occ", eventId: "today-evt", startsAt: new Date("2026-09-09T20:00:00-03:00"), status: "scheduled" }),
      ),
    );
    await repository.save(
      makeEvent(
        "other-day-evt",
        createTimedEventOccurrence({ id: "other-occ", eventId: "other-day-evt", startsAt: new Date("2026-09-20T20:00:00-03:00"), status: "scheduled" }),
      ),
    );

    const response = await app.inject({ method: "GET", url: "/v1/events?period=today" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((e: { slug: string }) => e.slug)).toEqual(["today-evt"]);
  });

  it("period=tomorrow returns events on the day after the injected reference date", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    await repository.save(
      makeEvent(
        "tomorrow-evt",
        createTimedEventOccurrence({ id: "tmrw-occ", eventId: "tomorrow-evt", startsAt: new Date("2026-09-10T20:00:00-03:00"), status: "scheduled" }),
      ),
    );

    const response = await app.inject({ method: "GET", url: "/v1/events?period=tomorrow" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((e: { slug: string }) => e.slug)).toEqual(["tomorrow-evt"]);
  });

  it("period=weekend returns Saturday/Sunday events, not a Friday one", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    await repository.save(
      makeEvent(
        "friday-evt",
        createTimedEventOccurrence({ id: "fri-occ", eventId: "friday-evt", startsAt: new Date("2026-09-11T20:00:00-03:00"), status: "scheduled" }),
      ),
    );
    await repository.save(
      makeEvent(
        "saturday-evt",
        createTimedEventOccurrence({ id: "sat-occ", eventId: "saturday-evt", startsAt: new Date("2026-09-12T20:00:00-03:00"), status: "scheduled" }),
      ),
    );

    const response = await app.inject({ method: "GET", url: "/v1/events?period=weekend" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((e: { slug: string }) => e.slug)).toEqual(["saturday-evt"]);
  });

  it("returns 400 invalid-filter-combination when period and start are both given", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/events?period=today&start=2026-09-10" });
    expect(response.statusCode).toBe(400);
    expect(response.json().type).toBe("/problems/invalid-filter-combination");
  });

  it("free=true returns only events with a known free price", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    await repository.save(makeEvent("free-evt", undefined, { price: { free: true, currency: "BRL" } }));
    await repository.save(makeEvent("paid-evt", undefined, { price: { free: false, currency: "BRL" } }));

    const response = await app.inject({ method: "GET", url: "/v1/events?free=true" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((e: { slug: string }) => e.slug)).toEqual(["free-evt"]);
  });

  it("q=jazz matches a title containing the term", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    await repository.save(makeEvent("jazz-evt", undefined, { title: "Noite de Jazz" }));
    await repository.save(makeEvent("rock-evt", undefined, { title: "Rock Clássico" }));

    const response = await app.inject({ method: "GET", url: "/v1/events?q=jazz" });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.map((e: { slug: string }) => e.slug)).toEqual(["jazz-evt"]);
  });

  it("lat/lng/radius returns nearby events with a distance_meters field", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    const venue = createVenue({
      id: "v-nearby",
      name: "Nearby Venue",
      city: "Porto Alegre",
      state: "RS",
      latitude: -30.035,
      longitude: -51.218,
    });
    await repository.save(makeEvent("nearby-evt", undefined, { venue }));

    const response = await app.inject({
      method: "GET",
      url: "/v1/events?lat=-30.0346&lng=-51.2177&radius=5000",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.map((e: { slug: string }) => e.slug)).toEqual(["nearby-evt"]);
    expect(typeof body.data[0].distance_meters).toBe("number");
  });

  it("returns 400 invalid-location for lat without lng", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/events?lat=-30.03" });
    expect(response.statusCode).toBe(400);
    expect(response.json().type).toBe("/problems/invalid-location");
  });

  it("returns 400 invalid-radius for an out-of-range radius", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/events?lat=-30.03&lng=-51.21&radius=999999" });
    expect(response.statusCode).toBe(400);
    expect(response.json().type).toBe("/problems/invalid-radius");
  });

  it("excludes cancelled events by default and includes them when status=cancelled is explicit", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    await repository.save(makeEvent("scheduled-evt"));
    await repository.save(makeEvent("cancelled-evt", undefined, { status: "cancelled" }));

    const defaultResponse = await app.inject({ method: "GET", url: "/v1/events" });
    expect(defaultResponse.json().data.map((e: { slug: string }) => e.slug)).toEqual(["scheduled-evt"]);

    const explicitResponse = await app.inject({ method: "GET", url: "/v1/events?status=cancelled" });
    expect(explicitResponse.json().data.map((e: { slug: string }) => e.slug)).toEqual(["cancelled-evt"]);
  });
});

// M9 section 22/38: suppression happens entirely server-side — the API returns already-
// deduplicated results, and the web app never implements any dedup rule of its own.
describe("GET /v1/events — dedup presentation suppression", () => {
  it("returns only the representative of an auto_approved pair", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    await repository.save(makeEvent("evt-plain"));
    await repository.save(makeEvent("evt-rich", undefined, { venue: createVenue({ id: "v-rich", name: "Venue", city: "Porto Alegre", state: "RS" }) }));
    const pair = normalizePair("evt-plain", "evt-rich");
    await upsertEngineEvaluation(
      connection.db,
      {
        leftEventId: pair.leftEventId,
        rightEventId: pair.rightEventId,
        score: 0.99,
        routing: "auto_merge",
        signals: { title: 1 },
        conflicts: [],
        autoMergeEligible: true,
        blockers: [],
      },
      NOW,
    );

    const response = await app.inject({ method: "GET", url: "/v1/events" });
    const slugs = response.json().data.map((e: { slug: string }) => e.slug);
    expect(slugs).toEqual(["evt-rich"]);
  });

  it("still returns both events of a pending_review pair", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    await repository.save(makeEvent("evt-x"));
    await repository.save(makeEvent("evt-y"));
    const pair = normalizePair("evt-x", "evt-y");
    await upsertEngineEvaluation(
      connection.db,
      {
        leftEventId: pair.leftEventId,
        rightEventId: pair.rightEventId,
        score: 0.85,
        routing: "review",
        signals: { title: 1 },
        conflicts: [],
        autoMergeEligible: false,
        blockers: [],
      },
      NOW,
    );

    const response = await app.inject({ method: "GET", url: "/v1/events" });
    const slugs = response.json().data.map((e: { slug: string }) => e.slug);
    expect(slugs).toEqual(expect.arrayContaining(["evt-x", "evt-y"]));
  });
});

// M7.1: OpenAPI documented this endpoint since M0 but server.ts never registered it —
// a contract break. Categories come only from real CanonicalEvent.categoryId values, never
// a hardcoded taxonomy (there is no categories table / human-readable name source yet).
describe("GET /v1/categories", () => {
  it("returns an empty list when no event has a category", async () => {
    const response = await app.inject({ method: "GET", url: "/v1/categories" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [] });
  });

  it("returns each distinct category once, in deterministic order, matching the OpenAPI Category shape", async () => {
    const repository = createCanonicalEventRepository(connection.db);
    await repository.save(makeEvent("evt-theater", undefined, { categoryId: "theater" }));
    await repository.save(makeEvent("evt-music-a", undefined, { categoryId: "music" }));
    await repository.save(makeEvent("evt-music-b", undefined, { categoryId: "music" }));

    const response = await app.inject({ method: "GET", url: "/v1/categories" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      data: [
        { id: "music", name: "music", slug: "music" },
        { id: "theater", name: "theater", slug: "theater" },
      ],
    });
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

describe("POST /v1/analytics", () => {
  it("accepts a well-formed event and persists it", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/analytics",
      payload: { event_name: "filter_used", metadata: { period: "weekend" } },
    });
    expect(response.statusCode).toBe(202);

    const summary = await computeProductSummary(connection.db);
    expect(summary.counts.filter_used).toBe(1);
  });

  it("rejects an unknown event_name with 400, and does not persist it", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/analytics",
      payload: { event_name: "totally_made_up" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toContain("application/problem+json");

    const summary = await computeProductSummary(connection.db);
    const totalPersisted = Object.values(summary.counts).reduce((sum, count) => sum + count, 0);
    expect(totalPersisted).toBe(0);
  });

  it("rejects a non-allowlisted metadata key with 400", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/analytics",
      payload: { event_name: "nearby_used", metadata: { latitude: -30.03 } },
    });
    expect(response.statusCode).toBe(400);
  });

  it("rejects an oversized payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/analytics",
      payload: { event_name: "search", metadata: { category: "x".repeat(10_000) } },
    });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
  });

  it("accepts an event scoped to an eventId", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/analytics",
      payload: { event_name: "event_view", event_id: "evt-timed" },
    });
    expect(response.statusCode).toBe(202);
  });
});
