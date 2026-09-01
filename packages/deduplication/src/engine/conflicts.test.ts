import { describe, expect, it } from "vitest";
import { detectConflicts } from "./conflicts.js";
import type { CanonicalEvent, Venue } from "@cult/domain";

function eventWith(overrides: Partial<CanonicalEvent>): CanonicalEvent {
  return {
    id: "x",
    slug: "x",
    title: "Some Event",
    subcategories: [],
    status: "scheduled",
    occurrences: [],
    performers: [],
    accessibility: [],
    sources: [],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: new Date(),
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function venue(overrides: Partial<Venue> & { name: string }): Venue {
  return { id: "x", city: "Porto Alegre", state: "RS", country: "BR", ...overrides };
}

describe("detectConflicts", () => {
  it("detects venue_conflict from a large geo distance regardless of name similarity", () => {
    const left = eventWith({ venue: venue({ name: "Venue A", latitude: -30.03, longitude: -51.22 }) });
    const right = eventWith({ venue: venue({ name: "Venue A", latitude: -30.15, longitude: -51.35 }) });
    expect(detectConflicts(left, right, {})).toContain("venue_conflict");
  });

  it("does not flag venue_conflict for nearby coordinates even with different names", () => {
    const left = eventWith({ venue: venue({ name: "Parque Farroupilha", latitude: -30.0356, longitude: -51.2110 }) });
    const right = eventWith({ venue: venue({ name: "Redenção", latitude: -30.0357, longitude: -51.2111 }) });
    expect(detectConflicts(left, right, {})).not.toContain("venue_conflict");
  });

  it("falls back to name dissimilarity for venue_conflict when neither side has coordinates", () => {
    const left = eventWith({ venue: venue({ name: "Usina do Gasômetro" }) });
    const right = eventWith({ venue: venue({ name: "Cinemateca Capitólio" }) });
    expect(detectConflicts(left, right, {})).toContain("venue_conflict");
  });

  it("does not flag venue_conflict when either side has no venue at all", () => {
    const left = eventWith({});
    const right = eventWith({ venue: venue({ name: "Usina do Gasômetro" }) });
    expect(detectConflicts(left, right, {})).not.toContain("venue_conflict");
  });

  it("detects city_conflict when both venues report different cities", () => {
    const left = eventWith({ venue: venue({ name: "Venue A", city: "Porto Alegre" }) });
    const right = eventWith({ venue: venue({ name: "Venue A", city: "Canoas" }) });
    expect(detectConflicts(left, right, {})).toContain("city_conflict");
  });

  it("detects edition_conflict from differing year tokens in otherwise similar titles", () => {
    const left = eventWith({ title: "Festival Jazz do Guaíba 2026" });
    const right = eventWith({ title: "Festival Jazz do Guaíba 2027" });
    expect(detectConflicts(left, right, {})).toContain("edition_conflict");
  });

  it("does not flag edition_conflict when titles have no year tokens", () => {
    const left = eventWith({ title: "Festival Jazz do Guaíba" });
    const right = eventWith({ title: "Festival Jazz do Guaíba" });
    expect(detectConflicts(left, right, {})).not.toContain("edition_conflict");
  });

  it("passes through the temporal assessment's conflict when present", () => {
    const left = eventWith({});
    const right = eventWith({});
    expect(detectConflicts(left, right, { conflict: "date_conflict" })).toContain("date_conflict");
    expect(detectConflicts(left, right, { conflict: "time_conflict" })).toContain("time_conflict");
  });
});
