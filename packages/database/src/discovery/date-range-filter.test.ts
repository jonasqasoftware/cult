import { describe, expect, it } from "vitest";
import { resolveDateRangeFilter } from "./date-range-filter.js";

const NOW = new Date("2026-09-09T15:00:00-03:00"); // Wednesday, 2026-09-09 local

describe("resolveDateRangeFilter — no temporal filter", () => {
  it("is ok with no range when neither period nor start/end are given", () => {
    const result = resolveDateRangeFilter({}, NOW);
    expect(result).toEqual({ ok: true, range: undefined });
  });
});

describe("resolveDateRangeFilter — period", () => {
  it("resolves a valid period", () => {
    const result = resolveDateRangeFilter({ period: "today" }, NOW);
    expect(result).toEqual({ ok: true, range: { start: "2026-09-09", end: "2026-09-09" } });
  });

  it("resolves this_week", () => {
    const result = resolveDateRangeFilter({ period: "this_week" }, NOW);
    expect(result).toEqual({ ok: true, range: { start: "2026-09-07", end: "2026-09-13" } });
  });

  it("rejects an unknown period", () => {
    const result = resolveDateRangeFilter({ period: "next_week" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-period" });
  });
});

describe("resolveDateRangeFilter — custom start/end", () => {
  it("resolves a valid custom range", () => {
    const result = resolveDateRangeFilter({ start: "2026-09-25", end: "2026-10-10" }, NOW);
    expect(result).toEqual({ ok: true, range: { start: "2026-09-25", end: "2026-10-10" } });
  });

  it("rejects a malformed date", () => {
    const result = resolveDateRangeFilter({ start: "25-09-2026", end: "2026-10-10" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-date" });
  });

  it("rejects a calendar date that doesn't exist", () => {
    const result = resolveDateRangeFilter({ start: "2026-02-30", end: "2026-03-01" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-date" });
  });

  it("rejects start after end", () => {
    const result = resolveDateRangeFilter({ start: "2026-10-10", end: "2026-09-25" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-date" });
  });

  it("rejects start without end", () => {
    const result = resolveDateRangeFilter({ start: "2026-09-25" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-filter-combination" });
  });

  it("rejects end without start", () => {
    const result = resolveDateRangeFilter({ end: "2026-09-25" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-filter-combination" });
  });
});

describe("resolveDateRangeFilter — period + start/end ambiguity", () => {
  it("rejects period combined with start", () => {
    const result = resolveDateRangeFilter({ period: "today", start: "2026-09-25" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-filter-combination" });
  });

  it("rejects period combined with end", () => {
    const result = resolveDateRangeFilter({ period: "today", end: "2026-09-25" }, NOW);
    expect(result).toEqual({ ok: false, error: "invalid-filter-combination" });
  });

  it("rejects period combined with both start and end", () => {
    const result = resolveDateRangeFilter(
      { period: "today", start: "2026-09-25", end: "2026-09-26" },
      NOW,
    );
    expect(result).toEqual({ ok: false, error: "invalid-filter-combination" });
  });
});
