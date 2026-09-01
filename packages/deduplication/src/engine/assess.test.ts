import { describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createDateOnlyEventOccurrence,
  createEventSourceReference,
  createTimedEventOccurrence,
  createVenue,
  type CanonicalEvent,
} from "@cult/domain";
import { assessDuplicate } from "./assess.js";

const REF = new Date("2026-01-01T00:00:00Z");

function source(id: string) {
  return createEventSourceReference({
    sourceId: id,
    url: `https://example.invalid/${id}`,
    firstSeenAt: REF,
    lastSeenAt: REF,
    confidence: 0.8,
  });
}

function baseInput(id: string, overrides: Partial<Parameters<typeof createCanonicalEvent>[0]> = {}) {
  return {
    id,
    slug: id,
    title: "Untitled Test Event",
    status: "scheduled" as const,
    occurrences: [
      createTimedEventOccurrence({
        id: `${id}-occ`,
        eventId: id,
        startsAt: new Date("2026-09-10T20:00:00-03:00"),
        status: "scheduled",
      }),
    ],
    sources: [source("ticketmaster")],
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

describe("assessDuplicate", () => {
  it("returns a high score and auto_merge for a strong, unambiguous match", () => {
    const venue = createVenue({ id: "v", name: "Test Concert Hall", city: "Porto Alegre", state: "RS" });
    const left = makeEvent("left", { title: "Unit Test Concert", venue });
    const right = makeEvent("right", { title: "Unit Test Concert", venue, sources: [source("destino-poa")] });

    const result = assessDuplicate(left, right);
    expect(result.score).toBeGreaterThanOrEqual(0.95);
    expect(result.routing).toBe("auto_merge");
    expect(result.detectedConflicts).toEqual([]);
  });

  it("returns a low score and separate for two clearly unrelated events", () => {
    const left = makeEvent("left", {
      title: "Poetry Night at the Library",
      venue: createVenue({ id: "v1", name: "City Library", city: "Porto Alegre", state: "RS" }),
    });
    const right = makeEvent("right", {
      title: "Electronic Music Festival",
      venue: createVenue({ id: "v2", name: "Riverside Park", city: "Porto Alegre", state: "RS" }),
      occurrences: [
        createTimedEventOccurrence({
          id: "right-occ",
          eventId: "right",
          startsAt: new Date("2026-12-20T22:00:00-03:00"),
          status: "scheduled",
        }),
      ],
    });

    const result = assessDuplicate(left, right);
    expect(result.score).toBeLessThan(0.5);
    expect(result.routing).toBe("separate");
  });

  it("routes to review, never auto_merge, when a critical conflict is detected even with a high score", () => {
    const left = makeEvent("left", {
      title: "Unit Test Concert",
      venue: createVenue({ id: "v1", name: "Venue Alpha", city: "Porto Alegre", state: "RS", latitude: -30.0, longitude: -51.0 }),
    });
    const right = makeEvent("right", {
      title: "Unit Test Concert",
      venue: createVenue({ id: "v2", name: "Venue Beta", city: "Porto Alegre", state: "RS", latitude: -30.2, longitude: -51.3 }),
      sources: [source("destino-poa")],
    });

    const result = assessDuplicate(left, right);
    expect(result.detectedConflicts).toContain("venue_conflict");
    expect(result.routing).not.toBe("auto_merge");
  });

  it("routes an ambiguous case (partial title overlap, matching time, no venue evidence) to review", () => {
    // Shares 3 of 4 significant words with the same instant but no venue/performer/url
    // evidence either way — not a confident match, not confidently unrelated.
    const left = makeEvent("left", { title: "Encontro Cultural Praça Central" });
    const right = makeEvent("right", {
      title: "Encontro Cultural Praça Histórica",
      sources: [source("destino-poa")],
    });

    const result = assessDuplicate(left, right);
    expect(result.routing).toBe("review");
  });

  it("does not let missing venue/performer/geo/url signals drag the score to zero", () => {
    const left = makeEvent("left", { title: "Unit Test Concert" });
    const right = makeEvent("right", { title: "Unit Test Concert", sources: [source("destino-poa")] });

    const result = assessDuplicate(left, right);
    expect(result.signals.venue).toBeUndefined();
    expect(result.signals.performer).toBeUndefined();
    expect(result.score).toBeGreaterThan(0.9);
  });

  it("reports the individual signal scores it computed", () => {
    const venue = createVenue({ id: "v", name: "Test Concert Hall", city: "Porto Alegre", state: "RS" });
    const left = makeEvent("left", { title: "Unit Test Concert", venue });
    const right = makeEvent("right", { title: "Unit Test Concert", venue, sources: [source("destino-poa")] });

    const result = assessDuplicate(left, right);
    expect(result.signals.title).toBe(1);
    expect(result.signals.venue).toBe(1);
    expect(result.signals.temporal).toBe(1);
  });

  it("gives a non-empty, human-readable reasons list", () => {
    const left = makeEvent("left", { title: "Unit Test Concert" });
    const right = makeEvent("right", { title: "Unit Test Concert", sources: [source("destino-poa")] });

    const result = assessDuplicate(left, right);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.every((reason) => typeof reason === "string" && reason.length > 0)).toBe(true);
  });

  it("is deterministic: identical input always produces identical output", () => {
    const venue = createVenue({ id: "v", name: "Test Concert Hall", city: "Porto Alegre", state: "RS" });
    const left = makeEvent("left", { title: "Unit Test Concert", venue });
    const right = makeEvent("right", { title: "Unit Test Concert", venue, sources: [source("destino-poa")] });

    expect(assessDuplicate(left, right)).toEqual(assessDuplicate(left, right));
  });

  it("keeps score within 0..1 bounds", () => {
    const left = makeEvent("left", { title: "Unit Test Concert" });
    const right = makeEvent("right", { title: "Unit Test Concert", sources: [source("destino-poa")] });
    const result = assessDuplicate(left, right);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  // M6.1: a perfect-looking match should not be enough for auto_merge when one source only
  // reports a calendar date and the other reports a precise time — ADR-0014 means the
  // date-only side never confirms the specific instant, no matter how well everything else
  // lines up. This scenario is entirely synthetic (not from the golden dataset) to prove the
  // rule generalizes rather than special-casing one fixture.
  it("blocks auto_merge for an otherwise-perfect match with mixed temporal precision", () => {
    const venue = createVenue({ id: "v", name: "Teatro Exemplo", city: "Porto Alegre", state: "RS" });
    const performers = [{ id: "perf-1", name: "Artista Exemplo" }];

    const left = makeEvent("left", {
      title: "Concerto Experimental",
      venue,
      performers,
      occurrences: [
        createTimedEventOccurrence({
          id: "left-occ",
          eventId: "left",
          startsAt: new Date("2026-09-25T20:00:00-03:00"),
          status: "scheduled",
        }),
      ],
    });
    const right = makeEvent("right", {
      title: "Concerto Experimental",
      venue,
      performers,
      sources: [source("destino-poa")],
      occurrences: [
        createDateOnlyEventOccurrence({
          id: "right-occ",
          eventId: "right",
          startDate: "2026-09-25",
          status: "scheduled",
        }),
      ],
    });

    const result = assessDuplicate(left, right);
    expect(result.score).toBeGreaterThanOrEqual(0.95);
    expect(result.autoMergeEligible).toBe(false);
    expect(result.autoMergeBlockers.length).toBeGreaterThan(0);
    expect(result.routing).toBe("review");
    expect(result.reasons.some((reason) => /mixed precision|time precision/i.test(reason))).toBe(true);
  });

  it("does not block auto_merge for a genuinely precise timed-vs-timed match", () => {
    const venue = createVenue({ id: "v", name: "Teatro Exemplo", city: "Porto Alegre", state: "RS" });
    const performers = [{ id: "perf-1", name: "Artista Exemplo" }];

    const left = makeEvent("left", { title: "Concerto Experimental", venue, performers });
    const right = makeEvent("right", {
      title: "Concerto Experimental",
      venue,
      performers,
      sources: [source("destino-poa")],
    });

    const result = assessDuplicate(left, right);
    expect(result.autoMergeEligible).toBe(true);
    expect(result.routing).toBe("auto_merge");
  });

  it("does not block auto_merge for a date-only-vs-date-only match (unchanged behavior)", () => {
    const venue = createVenue({ id: "v", name: "Teatro Exemplo", city: "Porto Alegre", state: "RS" });

    const left = makeEvent("left", {
      title: "Concerto Experimental",
      venue,
      occurrences: [
        createDateOnlyEventOccurrence({ id: "left-occ", eventId: "left", startDate: "2026-09-25", status: "scheduled" }),
      ],
    });
    const right = makeEvent("right", {
      title: "Concerto Experimental",
      venue,
      sources: [source("destino-poa")],
      occurrences: [
        createDateOnlyEventOccurrence({ id: "right-occ", eventId: "right", startDate: "2026-09-25", status: "scheduled" }),
      ],
    });

    const result = assessDuplicate(left, right);
    expect(result.autoMergeEligible).toBe(true);
    expect(result.routing).toBe("auto_merge");
  });

  it("does not use id, slug or sourceId as a matching signal", () => {
    // Same id/slug prefix and source, but a completely different title/venue/time — must
    // still be assessed as unrelated based on content, not identifiers.
    const left = makeEvent("shared-id-stem-a", { title: "Poetry Night at the Library" });
    const right = makeEvent("shared-id-stem-b", {
      title: "Electronic Music Festival",
      occurrences: [
        createTimedEventOccurrence({
          id: "right-occ",
          eventId: "shared-id-stem-b",
          startsAt: new Date("2026-12-20T22:00:00-03:00"),
          status: "scheduled",
        }),
      ],
    });

    const result = assessDuplicate(left, right);
    expect(result.routing).toBe("separate");
  });
});
