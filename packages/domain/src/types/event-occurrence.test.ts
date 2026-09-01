import { describe, expect, it } from "vitest";
import { createDateOnlyEventOccurrence, createTimedEventOccurrence } from "./event-occurrence.js";

describe("createTimedEventOccurrence", () => {
  const base = {
    id: "occ-1",
    eventId: "evt-1",
    startsAt: new Date("2026-09-01T22:00:00-03:00"),
    status: "scheduled" as const,
  };

  it("accepts a valid occurrence with no endsAt", () => {
    const occurrence = createTimedEventOccurrence(base);
    expect(occurrence.kind).toBe("timed");
    expect(occurrence.timezone).toBe("America/Sao_Paulo");
    expect(occurrence.endsAt).toBeUndefined();
  });

  it("accepts endsAt equal to startsAt", () => {
    const occurrence = createTimedEventOccurrence({ ...base, endsAt: base.startsAt });
    expect(occurrence.endsAt).toEqual(base.startsAt);
  });

  it("rejects endsAt before startsAt", () => {
    const endsAt = new Date(base.startsAt.getTime() - 1000);
    expect(() => createTimedEventOccurrence({ ...base, endsAt })).toThrow(
      /endsAt cannot be before startsAt/,
    );
  });
});

describe("createDateOnlyEventOccurrence", () => {
  const base = {
    id: "occ-1",
    eventId: "evt-1",
    startDate: "2026-09-10",
    status: "scheduled" as const,
  };

  it("accepts a valid single date with no endDate", () => {
    const occurrence = createDateOnlyEventOccurrence(base);
    expect(occurrence.kind).toBe("date");
    expect(occurrence.startDate).toBe("2026-09-10");
    expect(occurrence.endDate).toBeUndefined();
    expect(occurrence.timezone).toBe("America/Sao_Paulo");
  });

  it("accepts a valid range", () => {
    const occurrence = createDateOnlyEventOccurrence({ ...base, endDate: "2026-09-30" });
    expect(occurrence.startDate).toBe("2026-09-10");
    expect(occurrence.endDate).toBe("2026-09-30");
  });

  it("accepts endDate equal to startDate", () => {
    const occurrence = createDateOnlyEventOccurrence({ ...base, endDate: base.startDate });
    expect(occurrence.endDate).toBe(base.startDate);
  });

  it("rejects endDate before startDate", () => {
    expect(() => createDateOnlyEventOccurrence({ ...base, endDate: "2026-09-01" })).toThrow(
      /endDate cannot be before startDate/,
    );
  });

  it("rejects a non-canonical date format like 2026-2-1", () => {
    expect(() => createDateOnlyEventOccurrence({ ...base, startDate: "2026-2-1" })).toThrow(
      /valid YYYY-MM-DD date/,
    );
  });

  it("accepts a canonical zero-padded date like 2026-02-01", () => {
    const occurrence = createDateOnlyEventOccurrence({ ...base, startDate: "2026-02-01" });
    expect(occurrence.startDate).toBe("2026-02-01");
  });

  it("rejects an impossible calendar date like 2026-02-30", () => {
    expect(() => createDateOnlyEventOccurrence({ ...base, startDate: "2026-02-30" })).toThrow(
      /valid YYYY-MM-DD date/,
    );
  });

  it("rejects an invalid endDate format even when startDate is valid", () => {
    expect(() => createDateOnlyEventOccurrence({ ...base, endDate: "2026-13-40" })).toThrow(
      /valid YYYY-MM-DD date/,
    );
  });
});
