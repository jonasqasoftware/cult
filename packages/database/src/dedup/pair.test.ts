import { describe, expect, it } from "vitest";
import { normalizePair } from "./pair.js";

describe("normalizePair", () => {
  it("orders two ids lexicographically, smaller first", () => {
    expect(normalizePair("b-event", "a-event")).toEqual({ leftEventId: "a-event", rightEventId: "b-event" });
  });

  it("is order-independent — A,B and B,A normalize to the same pair", () => {
    expect(normalizePair("event-1", "event-2")).toEqual(normalizePair("event-2", "event-1"));
  });

  it("leaves an already-ordered pair unchanged", () => {
    expect(normalizePair("a-event", "b-event")).toEqual({ leftEventId: "a-event", rightEventId: "b-event" });
  });
});
