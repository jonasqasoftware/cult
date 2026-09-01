import { describe, expect, it } from "vitest";
import { validateAnalyticsEvent } from "./analytics.js";

describe("validateAnalyticsEvent", () => {
  it("accepts a known event name with no metadata", () => {
    const result = validateAnalyticsEvent({ eventName: "page_view" });
    expect(result.valid).toBe(true);
  });

  it("rejects an unknown event name", () => {
    const result = validateAnalyticsEvent({ eventName: "user_signed_up" });
    expect(result.valid).toBe(false);
  });

  it("accepts allowlisted metadata keys", () => {
    const result = validateAnalyticsEvent({ eventName: "filter_used", metadata: { period: "weekend", category: "music" } });
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error("expected valid");
    expect(result.metadata).toEqual({ period: "weekend", category: "music" });
  });

  it("rejects a non-allowlisted metadata key", () => {
    const result = validateAnalyticsEvent({
      eventName: "search",
      metadata: { latitude: -30.03, longitude: -51.21 },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects a metadata value that is an object (not string/number/boolean)", () => {
    const result = validateAnalyticsEvent({ eventName: "filter_used", metadata: { period: { nested: true } } });
    expect(result.valid).toBe(false);
  });

  it("rejects an overly long metadata string value", () => {
    const result = validateAnalyticsEvent({ eventName: "search", metadata: { category: "x".repeat(1000) } });
    expect(result.valid).toBe(false);
  });

  it("accepts a valid eventId alongside an event-scoped event name", () => {
    const result = validateAnalyticsEvent({ eventName: "event_view", eventId: "evt-123" });
    expect(result.valid).toBe(true);
    if (!result.valid) throw new Error("expected valid");
    expect(result.eventId).toBe("evt-123");
  });

  it("rejects a non-string eventId", () => {
    const result = validateAnalyticsEvent({ eventName: "event_view", eventId: 123 as unknown as string });
    expect(result.valid).toBe(false);
  });

  it("never accepts precise-geolocation-shaped metadata keys", () => {
    for (const key of ["lat", "lng", "latitude", "longitude"]) {
      const result = validateAnalyticsEvent({ eventName: "nearby_used", metadata: { [key]: -30.03 } });
      expect(result.valid).toBe(false);
    }
  });
});
