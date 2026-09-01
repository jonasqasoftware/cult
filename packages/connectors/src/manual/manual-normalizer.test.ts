import { describe, expect, it } from "vitest";
import { normalizeManualEvent } from "./manual-normalizer.js";
import type { ManualEventDto } from "./manual-types.js";

const NOW = new Date("2026-01-01T00:00:00Z");
const CONTEXT = { sourceId: "manual-beta", now: NOW };

// exactOptionalPropertyTypes: Partial<ManualEventDto> alone would reject `{ id: undefined }`
// as an override (it means "explicitly clear this field" in these tests, not "omit it").
type ManualEventDtoOverrides = { [K in keyof ManualEventDto]?: ManualEventDto[K] | undefined };

function baseDto(overrides: ManualEventDtoOverrides = {}): ManualEventDto {
  // Cast, not a widened return type: an override explicitly setting a field to `undefined`
  // (to exercise a "missing field" validation branch) is deliberate test-builder shorthand,
  // not a real ManualEventDto shape the normalizer would ever receive as such.
  return {
    id: "sarau-poa-001",
    title: "Sarau Cultural da Vila",
    startDate: "2026-11-10",
    startTime: "19:00",
    venueName: "Casa de Cultura da Vila",
    sourceUrl: "https://example.org/eventos/sarau-poa-001",
    ...overrides,
  } as ManualEventDto;
}

describe("normalizeManualEvent", () => {
  it("normalizes a well-formed manual event", () => {
    const result = normalizeManualEvent(baseDto(), CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.event.id).toBe("manual-beta-sarau-poa-001");
    expect(result.event.title).toBe("Sarau Cultural da Vila");
    expect(result.event.venue?.name).toBe("Casa de Cultura da Vila");
    expect(result.event.sources[0]?.url).toBe("https://example.org/eventos/sarau-poa-001");
  });

  it("rejects an event with no id", () => {
    const result = normalizeManualEvent(baseDto({ id: undefined }), CONTEXT);
    expect(result.ok).toBe(false);
  });

  it("rejects an event with no title", () => {
    const result = normalizeManualEvent(baseDto({ title: "  " }), CONTEXT);
    expect(result.ok).toBe(false);
  });

  it("rejects an event with no startDate", () => {
    const result = normalizeManualEvent(baseDto({ startDate: undefined }), CONTEXT);
    expect(result.ok).toBe(false);
  });

  it("rejects an event with no venue", () => {
    const result = normalizeManualEvent(baseDto({ venueName: undefined }), CONTEXT);
    expect(result.ok).toBe(false);
  });

  it("rejects an event with no sourceUrl", () => {
    const result = normalizeManualEvent(baseDto({ sourceUrl: undefined }), CONTEXT);
    expect(result.ok).toBe(false);
  });

  it("rejects an event with a malformed sourceUrl", () => {
    const result = normalizeManualEvent(baseDto({ sourceUrl: "not a url" }), CONTEXT);
    expect(result.ok).toBe(false);
  });

  it("rejects an event with a malformed ticketUrl", () => {
    const result = normalizeManualEvent(baseDto({ ticketUrl: "not a url" }), CONTEXT);
    expect(result.ok).toBe(false);
  });

  it("rejects an event with a negative priceValue", () => {
    const result = normalizeManualEvent(baseDto({ priceValue: -5 }), CONTEXT);
    expect(result.ok).toBe(false);
  });

  it("accepts a free event with no priceValue", () => {
    const result = normalizeManualEvent(baseDto({ free: true }), CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.event.price).toEqual({ free: true, currency: "BRL" });
  });

  it("drops imageUrl when rights are not confirmed, without failing normalization", () => {
    const result = normalizeManualEvent(
      baseDto({ imageUrl: "https://example.org/foto.jpg", imageRightsConfirmed: false }),
      CONTEXT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.event.imageUrl).toBeUndefined();
  });

  it("includes imageUrl only when rights are explicitly confirmed", () => {
    const result = normalizeManualEvent(
      baseDto({ imageUrl: "https://example.org/foto.jpg", imageRightsConfirmed: true }),
      CONTEXT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.event.imageUrl).toBe("https://example.org/foto.jpg");
  });

  it("uses the manual-beta source confidence for the event source reference", () => {
    const result = normalizeManualEvent(baseDto(), CONTEXT);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.event.sources[0]?.confidence).toBeGreaterThan(0.9);
  });
});
