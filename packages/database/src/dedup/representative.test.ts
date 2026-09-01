import { describe, expect, it } from "vitest";
import { createCanonicalEvent, createEventSourceReference, createTimedEventOccurrence, createVenue, type CanonicalEvent } from "@cult/domain";
import { selectRepresentative } from "./representative.js";

const REF = new Date("2026-01-01T00:00:00Z");

function source(sourceId: string, confidence: number) {
  return createEventSourceReference({
    sourceId,
    url: `https://example.org/${sourceId}`,
    firstSeenAt: REF,
    lastSeenAt: REF,
    confidence,
  });
}

function baseInput(id: string, overrides: Partial<Parameters<typeof createCanonicalEvent>[0]> = {}) {
  return {
    id,
    slug: id,
    title: "Test Event",
    status: "scheduled" as const,
    occurrences: [
      createTimedEventOccurrence({ id: `${id}-occ`, eventId: id, startsAt: new Date("2026-09-10T20:00:00-03:00"), status: "scheduled" }),
    ],
    sources: [source("test-source", 0.5)],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: REF,
    lastSeenAt: REF,
    createdAt: REF,
    updatedAt: REF,
    ...overrides,
  };
}

function makeEvent(id: string, overrides: Partial<Parameters<typeof createCanonicalEvent>[0]> = {}): CanonicalEvent {
  return createCanonicalEvent(baseInput(id, overrides));
}

describe("selectRepresentative — completeness", () => {
  it("prefers the event with more useful public fields filled in", () => {
    const sparse = makeEvent("sparse-event");
    const rich = makeEvent("rich-event", {
      description: "A great event.",
      categoryId: "music",
      venue: createVenue({ id: "v", name: "Venue", city: "Porto Alegre", state: "RS" }),
      imageUrl: "https://example.org/image.jpg",
      ticketUrl: "https://example.org/tickets",
    });
    expect(selectRepresentative(sparse, rich).id).toBe("rich-event");
    expect(selectRepresentative(rich, sparse).id).toBe("rich-event"); // order-independent
  });

  it("prefers the geo-tagged event over one with a venue but no coordinates (section 25)", () => {
    const noGeo = makeEvent("no-geo-event", {
      venue: createVenue({ id: "v1", name: "Venue", city: "Porto Alegre", state: "RS" }),
    });
    const withGeo = makeEvent("with-geo-event", {
      venue: createVenue({ id: "v2", name: "Venue", city: "Porto Alegre", state: "RS", latitude: -30.03, longitude: -51.21 }),
    });
    expect(selectRepresentative(noGeo, withGeo).id).toBe("with-geo-event");
  });
});

describe("selectRepresentative — source confidence tie-breaker", () => {
  it("prefers higher max source confidence when completeness is equal", () => {
    const lowConfidence = makeEvent("low-confidence-event", { sources: [source("s1", 0.4)] });
    const highConfidence = makeEvent("high-confidence-event", { sources: [source("s2", 0.9)] });
    expect(selectRepresentative(lowConfidence, highConfidence).id).toBe("high-confidence-event");
  });
});

describe("selectRepresentative — deterministic id tie-breaker", () => {
  it("prefers the lexicographically smaller id when everything else is equal", () => {
    const a = makeEvent("a-event");
    const b = makeEvent("b-event");
    expect(selectRepresentative(a, b).id).toBe("a-event");
    expect(selectRepresentative(b, a).id).toBe("a-event");
  });
});
