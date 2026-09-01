import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createDateOnlyEventOccurrence,
  createEventSourceReference,
  createSourceDefinition,
  createTimedEventOccurrence,
  createVenue,
  type EventOccurrence,
} from "@cult/domain";
import { createCanonicalEventRepository } from "../canonical-event-repository.js";
import { upsertSource } from "../source-repository.js";
import { connectTestDatabase, truncateAllTables } from "../test-support.js";
import { discoverEvents } from "./discover-events.js";
import { decodeCursor } from "./cursor.js";
import { resolvePeriod } from "./period.js";

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

const REF = new Date("2026-01-01T00:00:00Z");

function source() {
  return createEventSourceReference({
    sourceId: testSource.id,
    url: "https://example.org/e",
    firstSeenAt: REF,
    lastSeenAt: REF,
    confidence: 0.5,
  });
}

interface MakeEventOverrides {
  readonly title?: string;
  readonly description?: string;
  readonly occurrences?: readonly EventOccurrence[];
  readonly venue?: ReturnType<typeof createVenue>;
  readonly performers?: readonly { id: string; name: string }[];
  readonly categoryId?: string;
  readonly price?: { free: boolean; currency: "BRL" };
  readonly status?: "scheduled" | "cancelled" | "postponed" | "rescheduled" | "completed";
}

function makeEvent(id: string, overrides: MakeEventOverrides = {}) {
  return createCanonicalEvent({
    id,
    slug: id,
    title: overrides.title ?? `Event ${id}`,
    status: overrides.status ?? "scheduled",
    occurrences: overrides.occurrences ?? [
      createTimedEventOccurrence({
        id: `${id}-occ`,
        eventId: id,
        startsAt: new Date("2026-09-10T20:00:00-03:00"),
        status: "scheduled",
      }),
    ],
    sources: [source()],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: REF,
    lastSeenAt: REF,
    createdAt: REF,
    updatedAt: REF,
    ...(overrides.description !== undefined ? { description: overrides.description } : {}),
    ...(overrides.venue ? { venue: overrides.venue } : {}),
    ...(overrides.performers ? { performers: overrides.performers } : {}),
    ...(overrides.categoryId !== undefined ? { categoryId: overrides.categoryId } : {}),
    ...(overrides.price ? { price: overrides.price } : {}),
  });
}

function timed(id: string, isoLocal: string): EventOccurrence {
  return createTimedEventOccurrence({ id: `${id}-occ`, eventId: id, startsAt: new Date(isoLocal), status: "scheduled" });
}

function dateOnly(id: string, startDate: string, endDate?: string): EventOccurrence {
  return createDateOnlyEventOccurrence({
    id: `${id}-occ`,
    eventId: id,
    startDate,
    ...(endDate ? { endDate } : {}),
    status: "scheduled",
  });
}

const DEFAULT_QUERY = { limit: 20 } as const;

describe("discoverEvents — empty database", () => {
  it("returns an empty page when there are no events", async () => {
    const result = await discoverEvents(connection.db, DEFAULT_QUERY);
    expect(result).toEqual({ items: [], nextCursor: null });
  });
});

describe("discoverEvents — temporal: today", () => {
  it("includes a timed event happening today and excludes one happening yesterday", async () => {
    await repository.save(makeEvent("today-timed", { occurrences: [timed("today-timed", "2026-09-10T20:00:00-03:00")] }));
    await repository.save(makeEvent("yesterday-timed", { occurrences: [timed("yesterday-timed", "2026-09-09T20:00:00-03:00")] }));

    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, dateRange: { start: "2026-09-10", end: "2026-09-10" } });
    expect(result.items.map((i) => i.event.id)).toEqual(["today-timed"]);
  });

  it("includes a date-only event whose single date is today", async () => {
    await repository.save(makeEvent("today-date", { occurrences: [dateOnly("today-date", "2026-09-10")] }));
    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, dateRange: { start: "2026-09-10", end: "2026-09-10" } });
    expect(result.items.map((i) => i.event.id)).toEqual(["today-date"]);
  });

  it("includes a date-only RANGE that crosses today", async () => {
    await repository.save(makeEvent("range-crosses-today", { occurrences: [dateOnly("range-crosses-today", "2026-09-05", "2026-09-15")] }));
    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, dateRange: { start: "2026-09-10", end: "2026-09-10" } });
    expect(result.items.map((i) => i.event.id)).toEqual(["range-crosses-today"]);
  });
});

describe("discoverEvents — temporal: tomorrow (via resolvePeriod, proving the wiring)", () => {
  it("includes an event happening tomorrow relative to an injected clock", async () => {
    const now = new Date("2026-09-10T15:00:00-03:00");
    await repository.save(makeEvent("tomorrow-evt", { occurrences: [timed("tomorrow-evt", "2026-09-11T20:00:00-03:00")] }));
    await repository.save(makeEvent("today-evt", { occurrences: [timed("today-evt", "2026-09-10T20:00:00-03:00")] }));

    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, dateRange: resolvePeriod("tomorrow", now) });
    expect(result.items.map((i) => i.event.id)).toEqual(["tomorrow-evt"]);
  });
});

describe("discoverEvents — temporal: weekend", () => {
  // 2026-09-11 is a Friday, 2026-09-12 Saturday, 2026-09-13 Sunday.
  it("excludes Friday and includes Saturday and Sunday", async () => {
    await repository.save(makeEvent("friday", { occurrences: [timed("friday", "2026-09-11T20:00:00-03:00")] }));
    await repository.save(makeEvent("saturday", { occurrences: [timed("saturday", "2026-09-12T20:00:00-03:00")] }));
    await repository.save(makeEvent("sunday", { occurrences: [timed("sunday", "2026-09-13T20:00:00-03:00")] }));

    const now = new Date("2026-09-09T15:00:00-03:00"); // Wednesday of that week
    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, dateRange: resolvePeriod("weekend", now) });
    expect(result.items.map((i) => i.event.id).sort()).toEqual(["saturday", "sunday"]);
  });
});

describe("discoverEvents — custom start/end range", () => {
  it("includes overlap, excludes before and after, includes a spanning range", async () => {
    await repository.save(makeEvent("before", { occurrences: [dateOnly("before", "2026-09-01", "2026-09-04")] }));
    await repository.save(makeEvent("overlap", { occurrences: [dateOnly("overlap", "2026-09-08", "2026-09-12")] }));
    await repository.save(makeEvent("after", { occurrences: [dateOnly("after", "2026-09-20", "2026-09-25")] }));
    await repository.save(makeEvent("spanning", { occurrences: [dateOnly("spanning", "2026-08-01", "2026-10-01")] }));

    const result = await discoverEvents(connection.db, {
      ...DEFAULT_QUERY,
      dateRange: { start: "2026-09-10", end: "2026-09-15" },
    });
    expect(result.items.map((i) => i.event.id).sort()).toEqual(["overlap", "spanning"]);
  });

  it("makes a date-range event crossing a month boundary appear in both months queried separately", async () => {
    await repository.save(makeEvent("cross-month", { occurrences: [dateOnly("cross-month", "2026-09-25", "2026-10-10")] }));

    const september = await discoverEvents(connection.db, { ...DEFAULT_QUERY, dateRange: { start: "2026-09-01", end: "2026-09-30" } });
    const october = await discoverEvents(connection.db, { ...DEFAULT_QUERY, dateRange: { start: "2026-10-01", end: "2026-10-31" } });
    expect(september.items.map((i) => i.event.id)).toEqual(["cross-month"]);
    expect(october.items.map((i) => i.event.id)).toEqual(["cross-month"]);
  });
});

describe("discoverEvents — free", () => {
  it("free=true returns only events with a known free price, never unknown-price events", async () => {
    await repository.save(makeEvent("free-evt", { price: { free: true, currency: "BRL" } }));
    await repository.save(makeEvent("paid-evt", { price: { free: false, currency: "BRL" } }));
    await repository.save(makeEvent("unknown-price-evt"));

    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, free: true });
    expect(result.items.map((i) => i.event.id)).toEqual(["free-evt"]);
  });

  it("free=false returns only events explicitly known to be paid", async () => {
    await repository.save(makeEvent("free-evt", { price: { free: true, currency: "BRL" } }));
    await repository.save(makeEvent("paid-evt", { price: { free: false, currency: "BRL" } }));
    await repository.save(makeEvent("unknown-price-evt"));

    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, free: false });
    expect(result.items.map((i) => i.event.id)).toEqual(["paid-evt"]);
  });
});

describe("discoverEvents — category", () => {
  it("filters by categoryId", async () => {
    await repository.save(makeEvent("music-evt", { categoryId: "music" }));
    await repository.save(makeEvent("theater-evt", { categoryId: "theater" }));

    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, category: "music" });
    expect(result.items.map((i) => i.event.id)).toEqual(["music-evt"]);
  });
});

describe("discoverEvents — status", () => {
  it("defaults to scheduled, excluding cancelled events", async () => {
    await repository.save(makeEvent("scheduled-evt"));
    await repository.save(makeEvent("cancelled-evt", { status: "cancelled" }));

    const result = await discoverEvents(connection.db, DEFAULT_QUERY);
    expect(result.items.map((i) => i.event.id)).toEqual(["scheduled-evt"]);
  });

  it("returns an explicitly requested status", async () => {
    await repository.save(makeEvent("cancelled-evt", { status: "cancelled" }));
    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, status: "cancelled" });
    expect(result.items.map((i) => i.event.id)).toEqual(["cancelled-evt"]);
  });
});

describe("discoverEvents — search (q)", () => {
  it("matches by title", async () => {
    await repository.save(makeEvent("jazz-evt", { title: "Noite de Jazz" }));
    await repository.save(makeEvent("rock-evt", { title: "Rock Clássico" }));
    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, q: "jazz" });
    expect(result.items.map((i) => i.event.id)).toEqual(["jazz-evt"]);
  });

  it("is reasonably tolerant to accents and case", async () => {
    await repository.save(makeEvent("joao-evt", { title: "Show do João" }));
    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, q: "joao" });
    expect(result.items.map((i) => i.event.id)).toEqual(["joao-evt"]);
  });

  it("matches by venue name", async () => {
    const venue = createVenue({ id: "v-teatro", name: "Teatro Exemplo", city: "Porto Alegre", state: "RS" });
    await repository.save(makeEvent("venue-evt", { venue }));
    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, q: "teatro exemplo" });
    expect(result.items.map((i) => i.event.id)).toEqual(["venue-evt"]);
  });

  it("matches by performer name", async () => {
    await repository.save(makeEvent("performer-evt", { performers: [{ id: "p1", name: "Artista Exemplo" }] }));
    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, q: "artista exemplo" });
    expect(result.items.map((i) => i.event.id)).toEqual(["performer-evt"]);
  });

  it("does not match a clearly unrelated term", async () => {
    await repository.save(makeEvent("jazz-evt", { title: "Noite de Jazz" }));
    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, q: "futebol" });
    expect(result.items).toEqual([]);
  });
});

describe("discoverEvents — nearby", () => {
  const CENTER = { lat: -30.0346, lng: -51.2177 }; // Porto Alegre city center, approx.

  it("includes a venue inside the radius and reports its distance", async () => {
    const closeVenue = createVenue({
      id: "v-close",
      name: "Close Venue",
      city: "Porto Alegre",
      state: "RS",
      latitude: -30.035,
      longitude: -51.218,
    });
    await repository.save(makeEvent("close-evt", { venue: closeVenue }));

    const result = await discoverEvents(connection.db, {
      ...DEFAULT_QUERY,
      geo: { lat: CENTER.lat, lng: CENTER.lng, radiusMeters: 5000 },
    });
    expect(result.items.map((i) => i.event.id)).toEqual(["close-evt"]);
    expect(result.items[0]?.distanceMeters).toBeGreaterThanOrEqual(0);
    expect(result.items[0]?.distanceMeters).toBeLessThan(5000);
  });

  it("excludes a venue outside the radius", async () => {
    const farVenue = createVenue({
      id: "v-far",
      name: "Far Venue",
      city: "Porto Alegre",
      state: "RS",
      latitude: -29.5,
      longitude: -50.5,
    });
    await repository.save(makeEvent("far-evt", { venue: farVenue }));

    const result = await discoverEvents(connection.db, {
      ...DEFAULT_QUERY,
      geo: { lat: CENTER.lat, lng: CENTER.lng, radiusMeters: 5000 },
    });
    expect(result.items).toEqual([]);
  });

  it("excludes an event with no venue coordinates", async () => {
    await repository.save(makeEvent("no-geo-evt"));
    const result = await discoverEvents(connection.db, {
      ...DEFAULT_QUERY,
      geo: { lat: CENTER.lat, lng: CENTER.lng, radiusMeters: 5000 },
    });
    expect(result.items).toEqual([]);
  });
});

describe("discoverEvents — ordering", () => {
  it("orders by the soonest occurrence first by default", async () => {
    await repository.save(makeEvent("later", { occurrences: [timed("later", "2026-09-20T20:00:00-03:00")] }));
    await repository.save(makeEvent("sooner", { occurrences: [timed("sooner", "2026-09-11T20:00:00-03:00")] }));

    const result = await discoverEvents(connection.db, DEFAULT_QUERY);
    expect(result.items.map((i) => i.event.id)).toEqual(["sooner", "later"]);
  });
});

describe("discoverEvents — multi-occurrence", () => {
  it("matches an event if ANY occurrence satisfies the filter, not just the first", async () => {
    await repository.save(
      makeEvent("multi-occ", {
        occurrences: [timed("multi-occ", "2026-01-05T20:00:00-03:00"), timed("multi-occ-2", "2026-09-10T20:00:00-03:00")],
      }),
    );
    const result = await discoverEvents(connection.db, { ...DEFAULT_QUERY, dateRange: { start: "2026-09-10", end: "2026-09-10" } });
    expect(result.items.map((i) => i.event.id)).toEqual(["multi-occ"]);
  });
});

describe("discoverEvents — pagination", () => {
  it("paginates deterministically without duplicates across pages", async () => {
    await repository.save(makeEvent("evt-a", { occurrences: [timed("evt-a", "2026-09-10T10:00:00-03:00")] }));
    await repository.save(makeEvent("evt-b", { occurrences: [timed("evt-b", "2026-09-11T10:00:00-03:00")] }));
    await repository.save(makeEvent("evt-c", { occurrences: [timed("evt-c", "2026-09-12T10:00:00-03:00")] }));

    const firstPage = await discoverEvents(connection.db, { limit: 2 });
    expect(firstPage.items.map((i) => i.event.id)).toEqual(["evt-a", "evt-b"]);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await discoverEvents(connection.db, { limit: 2, cursor: firstPage.nextCursor! });
    expect(secondPage.items.map((i) => i.event.id)).toEqual(["evt-c"]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("returns a decodable, opaque cursor", async () => {
    await repository.save(makeEvent("evt-a", { occurrences: [timed("evt-a", "2026-09-10T10:00:00-03:00")] }));
    await repository.save(makeEvent("evt-b", { occurrences: [timed("evt-b", "2026-09-11T10:00:00-03:00")] }));

    const page = await discoverEvents(connection.db, { limit: 1 });
    expect(page.nextCursor).not.toBeNull();
    const decoded = decodeCursor(page.nextCursor!, "default");
    expect(decoded.ok).toBe(true);
  });

  it("paginates a nearby (distance-ordered) query without duplicates across pages", async () => {
    const CENTER = { lat: -30.0346, lng: -51.2177 };
    // Ordered far -> near by construction; expected page order is near -> far (distance ASC).
    await repository.save(
      makeEvent("far", { venue: createVenue({ id: "v-far2", name: "Far", city: "Porto Alegre", state: "RS", latitude: -30.06, longitude: -51.25 }) }),
    );
    await repository.save(
      makeEvent("near", { venue: createVenue({ id: "v-near2", name: "Near", city: "Porto Alegre", state: "RS", latitude: -30.035, longitude: -51.218 }) }),
    );
    await repository.save(
      makeEvent("mid", { venue: createVenue({ id: "v-mid2", name: "Mid", city: "Porto Alegre", state: "RS", latitude: -30.045, longitude: -51.23 }) }),
    );

    const geo = { lat: CENTER.lat, lng: CENTER.lng, radiusMeters: 10000 };
    const firstPage = await discoverEvents(connection.db, { limit: 2, geo });
    expect(firstPage.items.map((i) => i.event.id)).toEqual(["near", "mid"]);
    expect(firstPage.nextCursor).not.toBeNull();
    const decoded = decodeCursor(firstPage.nextCursor!, "nearby");
    expect(decoded.ok).toBe(true);

    const secondPage = await discoverEvents(connection.db, { limit: 2, geo, cursor: firstPage.nextCursor! });
    expect(secondPage.items.map((i) => i.event.id)).toEqual(["far"]);
    expect(secondPage.nextCursor).toBeNull();
  });
});
