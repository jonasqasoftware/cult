import { describe, expect, it } from "vitest";
import { hashPayload } from "./content-hash.js";

describe("hashPayload", () => {
  it("is deterministic for the same payload", () => {
    const payload = { id: "1", name: "Show" };
    expect(hashPayload(payload)).toBe(hashPayload(payload));
  });

  it("is independent of top-level and nested key order", () => {
    const a = { id: "1", nested: { x: 1, y: 2 } };
    const b = { nested: { y: 2, x: 1 }, id: "1" };
    expect(hashPayload(a)).toBe(hashPayload(b));
  });

  it("differs when content actually differs", () => {
    expect(hashPayload({ id: "1" })).not.toBe(hashPayload({ id: "2" }));
  });

  it("handles arrays and primitives", () => {
    expect(hashPayload([1, 2, 3])).toBe(hashPayload([1, 2, 3]));
    expect(hashPayload(null)).toBe(hashPayload(null));
  });
});
