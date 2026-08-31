import { describe, expect, it } from "vitest";
import { createEventOccurrence } from "./event-occurrence.js";

describe("createEventOccurrence", () => {
  const base = {
    id: "occ-1",
    eventId: "evt-1",
    startsAt: new Date("2026-09-01T22:00:00-03:00"),
    status: "scheduled" as const,
  };

  it("accepts a valid occurrence with no endsAt", () => {
    const occurrence = createEventOccurrence(base);
    expect(occurrence.timezone).toBe("America/Sao_Paulo");
    expect(occurrence.endsAt).toBeUndefined();
  });

  it("accepts endsAt equal to startsAt", () => {
    const occurrence = createEventOccurrence({ ...base, endsAt: base.startsAt });
    expect(occurrence.endsAt).toEqual(base.startsAt);
  });

  it("rejects endsAt before startsAt", () => {
    const endsAt = new Date(base.startsAt.getTime() - 1000);
    expect(() => createEventOccurrence({ ...base, endsAt })).toThrow(
      /endsAt cannot be before startsAt/,
    );
  });
});
