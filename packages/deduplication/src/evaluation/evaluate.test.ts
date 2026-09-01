import { describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createDateOnlyEventOccurrence,
  createEventSourceReference,
  createTimedEventOccurrence,
  type CanonicalEvent,
} from "@cult/domain";
import type { LoadedDedupCase } from "../golden-dataset/loader.js";
import { evaluateCases, selectPartition } from "./evaluate.js";

const REF = new Date("2026-01-01T00:00:00Z");

function source(id: string) {
  return createEventSourceReference({
    sourceId: id,
    url: `https://example.invalid/${id}`,
    firstSeenAt: REF,
    lastSeenAt: REF,
    confidence: 0.8,
  });
}

function timedCase(id: string, identityTruth: LoadedDedupCase["case"]["identityTruth"]): LoadedDedupCase {
  const left: CanonicalEvent = createCanonicalEvent({
    id: `${id}-left`,
    slug: `${id}-left`,
    title: "Unit Test Concert",
    status: "scheduled",
    occurrences: [
      createTimedEventOccurrence({
        id: `${id}-left-occ`,
        eventId: `${id}-left`,
        startsAt: new Date("2026-09-10T20:00:00-03:00"),
        status: "scheduled",
      }),
    ],
    sources: [source("ticketmaster")],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: REF,
    lastSeenAt: REF,
    createdAt: REF,
    updatedAt: REF,
  });

  const right: CanonicalEvent = createCanonicalEvent({
    id: `${id}-right`,
    slug: `${id}-right`,
    title: identityTruth === "same" ? "Unit Test Concert" : "Completely Unrelated Show",
    status: "scheduled",
    occurrences: [
      createTimedEventOccurrence({
        id: `${id}-right-occ`,
        eventId: `${id}-right`,
        startsAt:
          identityTruth === "same" ? new Date("2026-09-10T20:00:00-03:00") : new Date("2026-11-01T10:00:00-03:00"),
        status: "scheduled",
      }),
    ],
    sources: [source("destino-poa")],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: REF,
    lastSeenAt: REF,
    createdAt: REF,
    updatedAt: REF,
  });

  return {
    case: {
      id,
      identityTruth,
      expectedRouting: identityTruth === "same" ? "auto_merge" : "separate",
      difficulty: "easy",
      tags: [],
      criticalConflicts: [],
      description: "synthetic fixture for evaluate.ts unit test",
      rationale: "synthetic fixture for evaluate.ts unit test",
      left: {} as never,
      right: {} as never,
    },
    left,
    right,
  };
}

function dateVsTimedCase(id: string): LoadedDedupCase {
  const left: CanonicalEvent = createCanonicalEvent({
    id: `${id}-left`,
    slug: `${id}-left`,
    title: "Unit Test Concert",
    status: "scheduled",
    occurrences: [
      createDateOnlyEventOccurrence({
        id: `${id}-left-occ`,
        eventId: `${id}-left`,
        startDate: "2026-09-10",
        status: "scheduled",
      }),
    ],
    sources: [source("destino-poa")],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: REF,
    lastSeenAt: REF,
    createdAt: REF,
    updatedAt: REF,
  });

  const right: CanonicalEvent = createCanonicalEvent({
    id: `${id}-right`,
    slug: `${id}-right`,
    title: "Unit Test Concert",
    status: "scheduled",
    occurrences: [
      createTimedEventOccurrence({
        id: `${id}-right-occ`,
        eventId: `${id}-right`,
        startsAt: new Date("2026-09-10T20:00:00-03:00"),
        status: "scheduled",
      }),
    ],
    sources: [source("ticketmaster")],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: REF,
    lastSeenAt: REF,
    createdAt: REF,
    updatedAt: REF,
  });

  return {
    case: {
      id,
      identityTruth: "uncertain",
      expectedRouting: "review",
      difficulty: "medium",
      tags: [],
      criticalConflicts: [],
      description: "synthetic fixture for evaluate.ts unit test",
      rationale: "synthetic fixture for evaluate.ts unit test",
      left: {} as never,
      right: {} as never,
    },
    left,
    right,
  };
}

describe("evaluateCases", () => {
  it("runs the engine over every case and computes metrics from the results", () => {
    const cases = [timedCase("case-same", "same"), timedCase("case-different", "different")];
    const { results, metrics } = evaluateCases(cases);

    expect(results).toHaveLength(2);
    expect(results[0]?.caseId).toBe("case-same");
    expect(results[0]?.assessment.routing).toBe("auto_merge");
    expect(results[1]?.assessment.routing).toBe("separate");
    expect(metrics.totalCases).toBe(2);
    expect(metrics.routingAccuracy).toBe(1);
  });

  it("classifies the temporal pairing of each case from the built CanonicalEvents", () => {
    const cases = [timedCase("case-timed", "same"), dateVsTimedCase("case-mixed")];
    const { results } = evaluateCases(cases);

    expect(results[0]?.temporalPairing).toBe("timed-vs-timed");
    expect(results[1]?.temporalPairing).toBe("date-vs-timed");
  });
});

describe("selectPartition", () => {
  const cases = [timedCase("GD-P02", "same"), timedCase("GD-P01", "same"), timedCase("GD-N01", "different")];

  it("returns only holdout cases for 'holdout'", () => {
    const holdout = selectPartition(cases, "holdout");
    expect(holdout.map((c) => c.case.id)).toEqual(["GD-P02"]);
  });

  it("returns only non-holdout cases for 'calibration'", () => {
    const calibration = selectPartition(cases, "calibration");
    expect(calibration.map((c) => c.case.id).sort()).toEqual(["GD-N01", "GD-P01"]);
  });

  it("returns every case for 'all'", () => {
    const all = selectPartition(cases, "all");
    expect(all).toHaveLength(3);
  });
});
