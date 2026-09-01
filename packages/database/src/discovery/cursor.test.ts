import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor.js";

describe("encodeCursor / decodeCursor — default mode", () => {
  it("round-trips a default-mode cursor", () => {
    const cursor = { mode: "default" as const, sortInstant: "2026-09-10T20:00:00.000Z", id: "evt-a" };
    const encoded = encodeCursor(cursor);
    expect(decodeCursor(encoded, "default")).toEqual({ ok: true, value: cursor });
  });

  it("is opaque (not plain readable JSON/base64 of the raw values)", () => {
    const cursor = { mode: "default" as const, sortInstant: "2026-09-10T20:00:00.000Z", id: "evt-a" };
    const encoded = encodeCursor(cursor);
    expect(encoded).not.toContain("evt-a");
    expect(encoded).not.toContain("2026-09-10");
  });
});

describe("encodeCursor / decodeCursor — nearby mode", () => {
  it("round-trips a nearby-mode cursor with distance", () => {
    const cursor = {
      mode: "nearby" as const,
      distanceMeters: 1234.5,
      sortInstant: "2026-09-10T20:00:00.000Z",
      id: "evt-a",
    };
    const encoded = encodeCursor(cursor);
    expect(decodeCursor(encoded, "nearby")).toEqual({ ok: true, value: cursor });
  });
});

describe("decodeCursor — invalid input", () => {
  it("rejects a cursor that isn't valid base64url", () => {
    expect(decodeCursor("not-valid-base64!!!", "default")).toEqual({ ok: false });
  });

  it("rejects a cursor that decodes to something other than JSON", () => {
    const garbage = Buffer.from("not json at all", "utf8").toString("base64url");
    expect(decodeCursor(garbage, "default")).toEqual({ ok: false });
  });

  it("rejects a cursor missing required fields", () => {
    const malformed = Buffer.from(JSON.stringify({ mode: "default" }), "utf8").toString("base64url");
    expect(decodeCursor(malformed, "default")).toEqual({ ok: false });
  });

  it("rejects a default-mode cursor when a nearby-mode cursor was expected", () => {
    const cursor = { mode: "default" as const, sortInstant: "2026-09-10T20:00:00.000Z", id: "evt-a" };
    const encoded = encodeCursor(cursor);
    expect(decodeCursor(encoded, "nearby")).toEqual({ ok: false });
  });

  it("rejects a nearby-mode cursor when a default-mode cursor was expected", () => {
    const cursor = {
      mode: "nearby" as const,
      distanceMeters: 10,
      sortInstant: "2026-09-10T20:00:00.000Z",
      id: "evt-a",
    };
    const encoded = encodeCursor(cursor);
    expect(decodeCursor(encoded, "default")).toEqual({ ok: false });
  });
});
