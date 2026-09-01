import { describe, expect, it } from "vitest";
import { parseDiscoveryQuery } from "./discovery-query.js";

const NOW = new Date("2026-09-09T15:00:00-03:00");

describe("parseDiscoveryQuery — defaults", () => {
  it("defaults limit to 20 and has no filters with an empty query", () => {
    const result = parseDiscoveryQuery({}, NOW);
    expect(result).toEqual({ ok: true, value: { limit: 20 } });
  });
});

describe("parseDiscoveryQuery — limit", () => {
  it("parses a valid limit", () => {
    const result = parseDiscoveryQuery({ limit: "50" }, NOW);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.limit).toBe(50);
  });

  it("rejects a limit of 0", () => {
    const result = parseDiscoveryQuery({ limit: "0" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-limit", detail: expect.any(String) });
  });

  it("rejects a limit above the max", () => {
    const result = parseDiscoveryQuery({ limit: "101" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-limit", detail: expect.any(String) });
  });

  it("rejects a non-integer limit", () => {
    const result = parseDiscoveryQuery({ limit: "3.5" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-limit", detail: expect.any(String) });
  });
});

describe("parseDiscoveryQuery — period/start/end", () => {
  it("resolves a period into a dateRange", () => {
    const result = parseDiscoveryQuery({ period: "today" }, NOW);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.dateRange).toEqual({ start: "2026-09-09", end: "2026-09-09" });
  });

  it("rejects an invalid period", () => {
    const result = parseDiscoveryQuery({ period: "next_week" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-period", detail: expect.any(String) });
  });

  it("resolves a custom start/end range", () => {
    const result = parseDiscoveryQuery({ start: "2026-09-25", end: "2026-10-10" }, NOW);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.dateRange).toEqual({ start: "2026-09-25", end: "2026-10-10" });
  });

  it("rejects a malformed date", () => {
    const result = parseDiscoveryQuery({ start: "not-a-date", end: "2026-10-10" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-date", detail: expect.any(String) });
  });

  it("rejects period combined with start", () => {
    const result = parseDiscoveryQuery({ period: "today", start: "2026-09-25" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-filter-combination", detail: expect.any(String) });
  });
});

describe("parseDiscoveryQuery — category / q / free", () => {
  it("passes category through", () => {
    const result = parseDiscoveryQuery({ category: "music" }, NOW);
    expect(result.ok && result.value.category).toBe("music");
  });

  it("passes q through", () => {
    const result = parseDiscoveryQuery({ q: "jazz" }, NOW);
    expect(result.ok && result.value.q).toBe("jazz");
  });

  it("parses free=true", () => {
    const result = parseDiscoveryQuery({ free: "true" }, NOW);
    expect(result.ok && result.value.free).toBe(true);
  });

  it("parses free=false", () => {
    const result = parseDiscoveryQuery({ free: "false" }, NOW);
    expect(result.ok && result.value.free).toBe(false);
  });

  it("rejects a malformed free value", () => {
    const result = parseDiscoveryQuery({ free: "yes" }, NOW);
    expect(result.ok).toBe(false);
  });
});

describe("parseDiscoveryQuery — status", () => {
  it("passes a valid status through", () => {
    const result = parseDiscoveryQuery({ status: "cancelled" }, NOW);
    expect(result.ok && result.value.status).toBe("cancelled");
  });

  it("rejects an invalid status", () => {
    const result = parseDiscoveryQuery({ status: "not-a-status" }, NOW);
    expect(result.ok).toBe(false);
  });
});

describe("parseDiscoveryQuery — nearby (lat/lng/radius)", () => {
  it("parses a full lat/lng/radius filter", () => {
    const result = parseDiscoveryQuery({ lat: "-30.03", lng: "-51.23", radius: "2000" }, NOW);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.geo).toEqual({ lat: -30.03, lng: -51.23, radiusMeters: 2000 });
  });

  it("applies a default radius when lat/lng are given without radius", () => {
    const result = parseDiscoveryQuery({ lat: "-30.03", lng: "-51.23" }, NOW);
    expect(result.ok).toBe(true);
    expect(result.ok && result.value.geo?.radiusMeters).toBeGreaterThan(0);
  });

  it("rejects lat without lng", () => {
    const result = parseDiscoveryQuery({ lat: "-30.03" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-location", detail: expect.any(String) });
  });

  it("rejects lng without lat", () => {
    const result = parseDiscoveryQuery({ lng: "-51.23" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-location", detail: expect.any(String) });
  });

  it("rejects radius without lat/lng", () => {
    const result = parseDiscoveryQuery({ radius: "2000" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-location", detail: expect.any(String) });
  });

  it("rejects an out-of-range latitude", () => {
    const result = parseDiscoveryQuery({ lat: "200", lng: "-51.23" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-location", detail: expect.any(String) });
  });

  it("rejects an out-of-range longitude", () => {
    const result = parseDiscoveryQuery({ lat: "-30.03", lng: "-500" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-location", detail: expect.any(String) });
  });

  it("rejects a radius of 0", () => {
    const result = parseDiscoveryQuery({ lat: "-30.03", lng: "-51.23", radius: "0" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-radius", detail: expect.any(String) });
  });

  it("rejects a radius above the max", () => {
    const result = parseDiscoveryQuery({ lat: "-30.03", lng: "-51.23", radius: "999999" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-radius", detail: expect.any(String) });
  });
});

describe("parseDiscoveryQuery — cursor", () => {
  it("passes an opaque cursor string through unparsed (decoding happens in the query layer)", () => {
    const result = parseDiscoveryQuery({ cursor: "abc123" }, NOW);
    expect(result.ok && result.value.cursor).toBe("abc123");
  });
});
