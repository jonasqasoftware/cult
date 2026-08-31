import { describe, expect, it } from "vitest";
import { createCanonicalEvent } from "./canonical-event.js";
import { createEventOccurrence } from "./event-occurrence.js";
import { createEventSourceReference } from "./event-source-reference.js";

describe("createCanonicalEvent", () => {
  const occurrence = createEventOccurrence({
    id: "occ-1",
    eventId: "evt-1",
    startsAt: new Date("2026-09-01T22:00:00-03:00"),
    status: "scheduled",
  });

  const source = createEventSourceReference({
    sourceId: "src-1",
    url: "https://example.org/event/1",
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-02T00:00:00Z"),
    confidence: 0.8,
  });

  const base = {
    id: "evt-1",
    slug: "show-exemplo",
    title: "Show Exemplo",
    status: "scheduled" as const,
    occurrences: [occurrence],
    sources: [source],
    qualityScore: 0.7,
    rankingScore: 0.5,
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-02T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };

  it("accepts a valid canonical event and defaults empty collections", () => {
    const event = createCanonicalEvent(base);
    expect(event.subcategories).toEqual([]);
    expect(event.performers).toEqual([]);
    expect(event.accessibility).toEqual([]);
  });

  it("rejects an empty (or whitespace-only) title", () => {
    expect(() => createCanonicalEvent({ ...base, title: "  " })).toThrow(/title/);
  });

  it("rejects an empty slug", () => {
    expect(() => createCanonicalEvent({ ...base, slug: "" })).toThrow(/slug/);
  });

  it("rejects an event without occurrences", () => {
    expect(() => createCanonicalEvent({ ...base, occurrences: [] })).toThrow(/occurrence/);
  });

  it("rejects an event without sources", () => {
    expect(() => createCanonicalEvent({ ...base, sources: [] })).toThrow(/source/);
  });

  it("rejects qualityScore outside 0..1", () => {
    expect(() => createCanonicalEvent({ ...base, qualityScore: 1.2 })).toThrow(/qualityScore/);
    expect(() => createCanonicalEvent({ ...base, qualityScore: -0.1 })).toThrow(/qualityScore/);
  });

  it("rejects firstSeenAt after lastSeenAt", () => {
    expect(() =>
      createCanonicalEvent({
        ...base,
        firstSeenAt: base.lastSeenAt,
        lastSeenAt: base.firstSeenAt,
      }),
    ).toThrow(/firstSeenAt/);
  });

  it("rejects createdAt after updatedAt", () => {
    expect(() =>
      createCanonicalEvent({ ...base, createdAt: base.updatedAt, updatedAt: base.createdAt }),
    ).toThrow(/createdAt/);
  });
});
