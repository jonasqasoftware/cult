import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizeDestinoPOAEvent } from "./destino-poa-normalizer.js";
import { DESTINO_POA_SOURCE_ID } from "./destino-poa-fixture-adapter.js";
import type { DestinoPOAAgendaFeed, DestinoPOAEventDto } from "./destino-poa-types.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../test-data/golden-events/destino-poa/agenda-feed.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as DestinoPOAAgendaFeed;

function findFixtureEvent(id: string): DestinoPOAEventDto {
  const event = fixture.events.find((candidate) => candidate.id === id);
  if (!event) throw new Error(`fixture event not found: ${id}`);
  return event;
}

const now = new Date("2026-08-31T12:00:00Z");
const context = { sourceId: DESTINO_POA_SOURCE_ID, now };

describe("normalizeDestinoPOAEvent", () => {
  it("normalizes a complete event with price, venue, address and category", () => {
    const result = normalizeDestinoPOAEvent(findFixtureEvent("virada-cultural-porto-alegre-2026"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.event.title).toBe("Virada Cultural Porto Alegre");
    expect(result.event.venue?.name).toBe("Auditório Araújo Vianna");
    expect(result.event.venue?.city).toBe("Porto Alegre");
    expect(result.event.venue?.state).toBe("RS");
    expect(result.event.venue?.country).toBe("BR");
    expect(result.event.price).toEqual({ free: false, min: 40, max: 40, currency: "BRL" });
    expect(result.event.categoryId).toBe("cultural");
    expect(result.event.subcategories).toEqual(["show-de-musica"]);
    expect(result.event.occurrences[0]?.endsAt).toBeInstanceOf(Date);
    expect(result.event.sources[0]?.sourceId).toBe("destino-poa");
  });

  it("normalizes a free event", () => {
    const result = normalizeDestinoPOAEvent(findFixtureEvent("feira-do-livro-de-porto-alegre-2026"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.price).toEqual({ free: true, currency: "BRL" });
  });

  it("normalizes an event with no price information into price: undefined", () => {
    const result = normalizeDestinoPOAEvent(findFixtureEvent("roda-de-conversa-cultura-popular-2026"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.price).toBeUndefined();
  });

  it("fails explicitly on a multi-day date range (ADR-0014), never inventing a time", () => {
    const result = normalizeDestinoPOAEvent(
      findFixtureEvent("exposicao-arte-gaucha-contemporanea-2026"),
      context,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/ADR-0014|range|time/i);
  });

  it("normalizes an event with multiple categories", () => {
    const result = normalizeDestinoPOAEvent(findFixtureEvent("festival-cinema-independente-poa-2026"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.categoryId).toBe("cinema");
    expect(result.event.subcategories).toEqual(["cultural", "gratuito"]);
  });

  it("normalizes an event without an image into imageUrl: undefined", () => {
    const result = normalizeDestinoPOAEvent(findFixtureEvent("sarau-de-poesia-na-redencao-2026"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.imageUrl).toBeUndefined();
  });

  it("fails explicitly when a single day has no time of day, never inventing 00:00", () => {
    const result = normalizeDestinoPOAEvent(findFixtureEvent("encontro-de-food-trucks-2026"), context);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/time/i);
  });

  it("disambiguates from a Ticketmaster event that shares the exact same title", () => {
    const result = normalizeDestinoPOAEvent(findFixtureEvent("rock-in-porto-alegre-dpoa-2026"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.title).toBe("Rock in Porto Alegre");
    // Deterministic per-source id — distinct from ticketmaster-<id> even with the same title
    expect(result.event.id).toBe("destino-poa-rock-in-porto-alegre-dpoa-2026");
  });

  it("normalizes an event at a well-known venue with a full address", () => {
    const result = normalizeDestinoPOAEvent(
      findFixtureEvent("visita-guiada-usina-do-gasometro-2026"),
      context,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.venue?.name).toBe("Usina do Gasômetro");
    expect(result.event.venue?.address).toBe("Av. Presidente João Goulart, 551 - Farroupilha");
  });

  it("rejects malformed data with no title and no id/url", () => {
    const malformed = fixture.events[fixture.events.length - 1];
    if (!malformed) throw new Error("expected a malformed fixture entry");
    const result = normalizeDestinoPOAEvent(malformed, context);
    expect(result.ok).toBe(false);
  });

  it("builds provenance from context.now and the event's external id", () => {
    const result = normalizeDestinoPOAEvent(findFixtureEvent("virada-cultural-porto-alegre-2026"), context);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.event.sources[0]?.firstSeenAt).toEqual(now);
    expect(result.event.sources[0]?.confidence).toBeGreaterThan(0);
    expect(result.event.sources[0]?.confidence).toBeLessThanOrEqual(1);
  });
});
