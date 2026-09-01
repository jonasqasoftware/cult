import { describe, expect, it } from "vitest";
import { resolvePeriod } from "./period.js";

// All product-facing calendar-date semantics use America/Sao_Paulo, never the host's
// local timezone or UTC (section 6). `now` is always injected — never Date.now() — so these
// are pure, fast tests with no dependency on the real clock (section 40).
describe("resolvePeriod — today", () => {
  it("is the local calendar date for an instant late in the UTC day but still 'today' locally", () => {
    // 2026-09-10T23:30:00-03:00 is 2026-09-11T02:30:00Z — UTC already sees the 11th.
    const now = new Date("2026-09-11T02:30:00Z");
    expect(resolvePeriod("today", now)).toEqual({ start: "2026-09-10", end: "2026-09-10" });
  });

  it("is the local calendar date early in the local day (still the previous UTC day)", () => {
    // 2026-09-10T00:30:00-03:00 is 2026-09-10T03:30:00Z.
    const now = new Date("2026-09-10T03:30:00Z");
    expect(resolvePeriod("today", now)).toEqual({ start: "2026-09-10", end: "2026-09-10" });
  });
});

describe("resolvePeriod — tomorrow", () => {
  it("is the next local calendar date", () => {
    const now = new Date("2026-09-10T15:00:00-03:00");
    expect(resolvePeriod("tomorrow", now)).toEqual({ start: "2026-09-11", end: "2026-09-11" });
  });

  it("rolls over a month boundary", () => {
    const now = new Date("2026-09-30T15:00:00-03:00");
    expect(resolvePeriod("tomorrow", now)).toEqual({ start: "2026-10-01", end: "2026-10-01" });
  });

  it("rolls over a year boundary", () => {
    const now = new Date("2026-12-31T15:00:00-03:00");
    expect(resolvePeriod("tomorrow", now)).toEqual({ start: "2027-01-01", end: "2027-01-01" });
  });
});

describe("resolvePeriod — weekend", () => {
  it("is Saturday through Sunday when today is a weekday (Tuesday)", () => {
    // 2026-09-08 is a Tuesday.
    const now = new Date("2026-09-08T15:00:00-03:00");
    expect(resolvePeriod("weekend", now)).toEqual({ start: "2026-09-12", end: "2026-09-13" });
  });

  it("is the current weekend when today is already Saturday", () => {
    const now = new Date("2026-09-12T15:00:00-03:00");
    expect(resolvePeriod("weekend", now)).toEqual({ start: "2026-09-12", end: "2026-09-13" });
  });

  it("is the current weekend when today is already Sunday", () => {
    const now = new Date("2026-09-13T15:00:00-03:00");
    expect(resolvePeriod("weekend", now)).toEqual({ start: "2026-09-12", end: "2026-09-13" });
  });

  it("is Friday not included", () => {
    // 2026-09-11 is a Friday — must resolve to the FOLLOWING weekend, not include the 11th.
    const now = new Date("2026-09-11T15:00:00-03:00");
    const result = resolvePeriod("weekend", now);
    expect(result.start).not.toBe("2026-09-11");
    expect(result).toEqual({ start: "2026-09-12", end: "2026-09-13" });
  });
});

describe("resolvePeriod — this_week (Monday-Sunday)", () => {
  it("resolves the containing week from a mid-week Wednesday", () => {
    // 2026-09-09 is a Wednesday; the containing week is Mon 2026-09-07..Sun 2026-09-13.
    const now = new Date("2026-09-09T15:00:00-03:00");
    expect(resolvePeriod("this_week", now)).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });

  it("resolves the containing week when today is Monday", () => {
    const now = new Date("2026-09-07T15:00:00-03:00");
    expect(resolvePeriod("this_week", now)).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });

  it("resolves the containing week when today is Sunday", () => {
    const now = new Date("2026-09-13T15:00:00-03:00");
    expect(resolvePeriod("this_week", now)).toEqual({ start: "2026-09-07", end: "2026-09-13" });
  });
});

describe("resolvePeriod — this_month", () => {
  it("resolves the first and last day of the current month", () => {
    const now = new Date("2026-09-15T15:00:00-03:00");
    expect(resolvePeriod("this_month", now)).toEqual({ start: "2026-09-01", end: "2026-09-30" });
  });

  it("handles February in a leap year", () => {
    const now = new Date("2028-02-10T15:00:00-03:00");
    expect(resolvePeriod("this_month", now)).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("handles December rolling into a new year internally without leaking into the range", () => {
    const now = new Date("2026-12-15T15:00:00-03:00");
    expect(resolvePeriod("this_month", now)).toEqual({ start: "2026-12-01", end: "2026-12-31" });
  });
});
