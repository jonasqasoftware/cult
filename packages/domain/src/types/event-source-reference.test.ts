import { describe, expect, it } from "vitest";
import { createEventSourceReference } from "./event-source-reference.js";

describe("createEventSourceReference", () => {
  const base = {
    sourceId: "src-1",
    url: "https://example.org/event/1",
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-02T00:00:00Z"),
    confidence: 0.5,
  };

  it("accepts confidence of 0", () => {
    expect(createEventSourceReference({ ...base, confidence: 0 }).confidence).toBe(0);
  });

  it("accepts confidence of 1", () => {
    expect(createEventSourceReference({ ...base, confidence: 1 }).confidence).toBe(1);
  });

  it("rejects confidence outside 0..1", () => {
    expect(() => createEventSourceReference({ ...base, confidence: 1.5 })).toThrow(/confidence/);
    expect(() => createEventSourceReference({ ...base, confidence: -0.5 })).toThrow(/confidence/);
  });
});
