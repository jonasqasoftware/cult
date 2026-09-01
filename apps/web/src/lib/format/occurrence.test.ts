import { describe, expect, it } from "vitest";
import { formatDateOnly, formatDateRange, formatOccurrence, formatTimedOccurrence } from "./occurrence.js";
import type { EventOccurrence } from "../api/types.js";

describe("formatTimedOccurrence", () => {
  it("formats an instant in America/Sao_Paulo, on-the-hour with no minutes shown", () => {
    // 2026-09-20T23:00:00Z = 2026-09-20T20:00:00-03:00
    expect(formatTimedOccurrence("2026-09-20T23:00:00Z")).toBe("20 set · 20h");
  });

  it("includes minutes when the instant is not on the hour", () => {
    // 2026-09-20T22:30:00Z = 2026-09-20T19:30:00-03:00
    expect(formatTimedOccurrence("2026-09-20T22:30:00Z")).toBe("20 set · 19h30");
  });

  it("shows the LOCAL calendar date, which can differ from the UTC date", () => {
    // 2026-09-21T02:00:00Z = 2026-09-20T23:00:00-03:00 — still the 20th locally.
    expect(formatTimedOccurrence("2026-09-21T02:00:00Z")).toBe("20 set · 23h");
  });
});

describe("formatDateOnly", () => {
  it("formats a calendar date as day + abbreviated month, in pt-BR", () => {
    expect(formatDateOnly("2026-09-20")).toBe("20 set");
  });

  it("never constructs a JS Date from the date-only string (no timezone involved)", () => {
    // A string like "2026-01-01" parsed via `new Date(...)` is UTC midnight, which renders as
    // Dec 31 in any timezone west of UTC. If this function used that, this test would fail in
    // a west-of-UTC CI runner. It must not.
    expect(formatDateOnly("2026-01-01")).toBe("1 jan");
  });

  it("does not zero-pad the day", () => {
    expect(formatDateOnly("2026-09-05")).toBe("5 set");
  });
});

describe("formatDateRange", () => {
  it("formats a same-month range compactly", () => {
    expect(formatDateRange("2026-09-01", "2026-09-30")).toBe("1–30 set");
  });

  it("formats a cross-month range with both month labels", () => {
    expect(formatDateRange("2026-09-25", "2026-10-10")).toBe("25 set – 10 out");
  });

  it("formats a single-day range (no end, or end equal to start) like a plain date", () => {
    expect(formatDateRange("2026-09-20")).toBe("20 set");
    expect(formatDateRange("2026-09-20", "2026-09-20")).toBe("20 set");
  });
});

describe("formatOccurrence", () => {
  it("dispatches a timed occurrence to formatTimedOccurrence", () => {
    const occurrence: EventOccurrence = {
      kind: "timed",
      starts_at: "2026-09-20T23:00:00Z",
      ends_at: null,
      timezone: "America/Sao_Paulo",
      status: "scheduled",
    };
    expect(formatOccurrence(occurrence)).toBe("20 set · 20h");
  });

  it("dispatches a date-only occurrence to formatDateRange", () => {
    const occurrence: EventOccurrence = {
      kind: "date",
      start_date: "2026-09-01",
      end_date: "2026-09-30",
      timezone: "America/Sao_Paulo",
      status: "scheduled",
    };
    expect(formatOccurrence(occurrence)).toBe("1–30 set");
  });

  it("never fabricates a 00:00 time for a date-only occurrence", () => {
    const occurrence: EventOccurrence = {
      kind: "date",
      start_date: "2026-09-20",
      end_date: null,
      timezone: "America/Sao_Paulo",
      status: "scheduled",
    };
    expect(formatOccurrence(occurrence)).not.toContain("00h");
    expect(formatOccurrence(occurrence)).not.toContain(":");
  });
});
