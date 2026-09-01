import { describe, expect, it } from "vitest";
import { assessTemporal } from "./temporal.js";
import type { DateOnlyEventOccurrence, TimedEventOccurrence } from "@cult/domain";

function timed(startsAt: string, endsAt?: string): TimedEventOccurrence {
  return {
    kind: "timed",
    id: "x",
    eventId: "x",
    startsAt: new Date(startsAt),
    ...(endsAt ? { endsAt: new Date(endsAt) } : {}),
    timezone: "America/Sao_Paulo",
    status: "scheduled",
  };
}

function dateOnly(startDate: string, endDate?: string): DateOnlyEventOccurrence {
  return {
    kind: "date",
    id: "x",
    eventId: "x",
    startDate,
    ...(endDate ? { endDate } : {}),
    timezone: "America/Sao_Paulo",
    status: "scheduled",
  };
}

describe("assessTemporal — timed vs timed", () => {
  it("is a perfect match for the same instant", () => {
    const result = assessTemporal(timed("2026-09-10T20:00:00-03:00"), timed("2026-09-10T20:00:00-03:00"));
    expect(result.similarity).toBe(1);
    expect(result.compatible).toBe(true);
    expect(result.conflict).toBeUndefined();
    expect(result.evidence).toBe("timed_pair");
  });

  it("is a perfect match for the same instant in different offset notation", () => {
    const result = assessTemporal(
      timed("2026-09-15T22:00:00-03:00"),
      timed("2026-09-16T01:00:00+00:00"),
    );
    expect(result.similarity).toBe(1);
    expect(result.conflict).toBeUndefined();
  });

  it("gives intermediate similarity and no conflict for a small time difference same day", () => {
    const result = assessTemporal(
      timed("2026-09-27T17:00:00-03:00"),
      timed("2026-09-27T17:30:00-03:00"),
    );
    expect(result.similarity).toBeGreaterThan(0.5);
    expect(result.similarity).toBeLessThan(1);
    expect(result.conflict).toBeUndefined();
  });

  it("flags time_conflict for a large same-day time difference", () => {
    const result = assessTemporal(
      timed("2026-09-20T15:00:00-03:00"),
      timed("2026-09-20T20:30:00-03:00"),
    );
    expect(result.conflict).toBe("time_conflict");
    expect(result.compatible).toBe(false);
  });

  it("flags date_conflict when the local calendar dates differ", () => {
    const result = assessTemporal(
      timed("2026-09-06T10:00:00-03:00"),
      timed("2026-09-27T10:00:00-03:00"),
    );
    expect(result.conflict).toBe("date_conflict");
    expect(result.similarity).toBe(0);
  });
});

describe("assessTemporal — date-only vs date-only", () => {
  it("is a perfect match for the same single date", () => {
    const result = assessTemporal(dateOnly("2026-09-05"), dateOnly("2026-09-05"));
    expect(result.similarity).toBe(1);
    expect(result.compatible).toBe(true);
    expect(result.evidence).toBe("date_pair");
  });

  it("is still a date_pair when one side is a date range", () => {
    const result = assessTemporal(dateOnly("2026-09-01", "2026-09-15"), dateOnly("2026-09-10"));
    expect(result.evidence).toBe("date_pair");
  });

  it("flags date_conflict for disjoint ranges", () => {
    const result = assessTemporal(
      dateOnly("2026-09-01", "2026-09-30"),
      dateOnly("2026-11-01", "2026-11-20"),
    );
    expect(result.conflict).toBe("date_conflict");
    expect(result.compatible).toBe(false);
  });

  it("gives partial similarity for overlapping ranges, not a conflict", () => {
    const result = assessTemporal(
      dateOnly("2026-09-01", "2026-09-15"),
      dateOnly("2026-09-10", "2026-09-25"),
    );
    expect(result.compatible).toBe(true);
    expect(result.conflict).toBeUndefined();
    expect(result.similarity).toBeGreaterThan(0);
    expect(result.similarity).toBeLessThan(1);
  });
});

describe("assessTemporal — timed vs date-only", () => {
  it("is compatible (no conflict) when the timed instant's local date falls inside the range", () => {
    const result = assessTemporal(
      dateOnly("2026-09-01", "2026-09-30"),
      timed("2026-09-10T21:00:00-03:00"),
    );
    expect(result.compatible).toBe(true);
    expect(result.conflict).toBeUndefined();
    expect(result.similarity).toBeGreaterThan(0);
    expect(result.evidence).toBe("mixed_precision");
  });

  it("is a strong match when the timed instant's local date equals a single date-only day, but the evidence is still mixed precision", () => {
    const result = assessTemporal(dateOnly("2026-09-05"), timed("2026-09-05T19:00:00-03:00"));
    expect(result.similarity).toBe(1);
    expect(result.compatible).toBe(true);
    // ADR-0014: kind=date means "no time precision reported," never "all day" — a perfect
    // calendar-date match against a precise instant is still NOT the same strength of evidence
    // as two sources agreeing on the same instant. See engine/eligibility.ts.
    expect(result.evidence).toBe("mixed_precision");
  });

  it("is mixed precision regardless of which side is timed", () => {
    const dateFirst = assessTemporal(dateOnly("2026-09-05"), timed("2026-09-05T19:00:00-03:00"));
    const timedFirst = assessTemporal(timed("2026-09-05T19:00:00-03:00"), dateOnly("2026-09-05"));
    expect(dateFirst.evidence).toBe("mixed_precision");
    expect(timedFirst.evidence).toBe("mixed_precision");
  });

  it("flags date_conflict when the timed instant falls outside the date-only range", () => {
    const result = assessTemporal(
      dateOnly("2026-09-01", "2026-09-05"),
      timed("2026-10-01T19:00:00-03:00"),
    );
    expect(result.conflict).toBe("date_conflict");
  });
});
