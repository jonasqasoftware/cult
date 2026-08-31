import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeTicketmasterEvent } from "./ticketmaster-normalizer.js";
import { TICKETMASTER_SOURCE_ID } from "./ticketmaster-adapter.js";
import type { TicketmasterEvent, TicketmasterEventSearchResponse } from "./ticketmaster-types.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../test-data/golden-events/ticketmaster/event-search-response.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as TicketmasterEventSearchResponse;

function findFixtureEvent(id: string): TicketmasterEvent {
  const event = fixture._embedded?.events?.find((candidate) => candidate.id === id);
  if (!event) throw new Error(`fixture event not found: ${id}`);
  return event;
}

const now = new Date("2026-08-31T12:00:00Z");
const context = { sourceId: TICKETMASTER_SOURCE_ID, now };

describe("normalizeTicketmasterEvent", () => {
  it("normalizes a complete event with price, image, venue, coordinates and performers", () => {
    const result = normalizeTicketmasterEvent(findFixtureEvent("TM-EVT-COMPLETE-0001"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.event.title).toBe("Rock in Porto Alegre");
    expect(result.event.status).toBe("scheduled");
    expect(result.event.venue?.name).toBe("Arena do Grêmio");
    expect(result.event.venue?.latitude).toBeCloseTo(-30.0654);
    expect(result.event.venue?.longitude).toBeCloseTo(-51.2354);
    expect(result.event.price).toEqual({ free: false, min: 80, max: 350, currency: "BRL" });
    expect(result.event.imageUrl).toBe("https://example.invalid/tm/complete-0001.jpg");
    expect(result.event.performers).toEqual([{ id: "TM-ATTR-0001", name: "Banda Exemplo" }]);
    expect(result.event.sources).toHaveLength(1);
    expect(result.event.sources[0]?.sourceId).toBe("ticketmaster");
    expect(result.event.sources[0]?.externalId).toBe("TM-EVT-COMPLETE-0001");
    expect(result.event.categoryId).toBe("music");
    expect(result.event.subcategories).toEqual(["rock"]);
  });

  it("normalizes an event without a price into price: undefined", () => {
    const result = normalizeTicketmasterEvent(findFixtureEvent("TM-EVT-NOPRICE-0002"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.price).toBeUndefined();
  });

  it("normalizes a free event (min/max 0) without images into a free price and no imageUrl", () => {
    const result = normalizeTicketmasterEvent(findFixtureEvent("TM-EVT-NOIMAGE-0003"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.imageUrl).toBeUndefined();
    expect(result.event.price).toEqual({ free: true, currency: "BRL" });
  });

  it("normalizes an event without a venue into venue: undefined", () => {
    const result = normalizeTicketmasterEvent(findFixtureEvent("TM-EVT-NOVENUE-0004"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.venue).toBeUndefined();
  });

  it("maps a cancelled Ticketmaster event to status cancelled", () => {
    const result = normalizeTicketmasterEvent(findFixtureEvent("TM-EVT-CANCELLED-0005"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.status).toBe("cancelled");
  });

  it("fails explicitly (never guesses) on an unmappable status code", () => {
    const result = normalizeTicketmasterEvent(findFixtureEvent("TM-EVT-BADSTATUS-0006"), context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/status/i);
  });

  it("builds provenance from context.now and the event's external id", () => {
    const result = normalizeTicketmasterEvent(findFixtureEvent("TM-EVT-COMPLETE-0001"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.sources[0]?.firstSeenAt).toEqual(now);
    expect(result.event.sources[0]?.lastSeenAt).toEqual(now);
  });

  it("produces a deterministic id/slug regardless of context.now", () => {
    const first = normalizeTicketmasterEvent(findFixtureEvent("TM-EVT-COMPLETE-0001"), context);
    const second = normalizeTicketmasterEvent(findFixtureEvent("TM-EVT-COMPLETE-0001"), {
      ...context,
      now: new Date("2027-01-01T00:00:00Z"),
    });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.event.id).toBe(second.event.id);
    expect(first.event.slug).toBe(second.event.slug);
  });

  it("rejects an event with no name", () => {
    const result = normalizeTicketmasterEvent(
      { ...findFixtureEvent("TM-EVT-COMPLETE-0001"), name: "  " },
      context,
    );
    expect(result.ok).toBe(false);
  });
});
