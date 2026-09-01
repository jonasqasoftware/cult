import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  createCanonicalEvent,
  createDateOnlyEventOccurrence,
  createEventSourceReference,
  createSourceDefinition,
  createTimedEventOccurrence,
  type EventOccurrence,
} from "@cult/domain";
import { createCanonicalEventRepository } from "../canonical-event-repository.js";
import { findCandidatePairs } from "./find-candidate-pairs.js";
import { upsertSource } from "../source-repository.js";
import { connectTestDatabase, truncateAllTables } from "../test-support.js";

const connection = connectTestDatabase();
const repository = createCanonicalEventRepository(connection.db);

const sourceA = createSourceDefinition({
  id: "source-a",
  name: "Source A",
  type: "api",
  enabled: true,
  pollingIntervalMinutes: 30,
  authorityScore: 0.5,
  commercialUse: "unknown",
  connector: "connector-a",
});
const sourceB = createSourceDefinition({
  id: "source-b",
  name: "Source B",
  type: "crawler",
  enabled: true,
  pollingIntervalMinutes: 30,
  authorityScore: 0.5,
  commercialUse: "unknown",
  connector: "connector-b",
});

beforeEach(async () => {
  await truncateAllTables(connection);
  await upsertSource(connection.db, sourceA);
  await upsertSource(connection.db, sourceB);
});

afterAll(async () => {
  await connection.close();
});

function eventSource(sourceId: string) {
  return createEventSourceReference({
    sourceId,
    url: `https://example.org/${sourceId}`,
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-01T00:00:00Z"),
    confidence: 0.5,
  });
}

function makeEvent(
  id: string,
  title: string,
  sourceId: string,
  occurrence?: EventOccurrence,
  status: "scheduled" | "cancelled" = "scheduled",
) {
  return createCanonicalEvent({
    id,
    slug: id,
    title,
    status,
    occurrences: [
      occurrence ??
        createTimedEventOccurrence({ id: `${id}-occ`, eventId: id, startsAt: new Date("2026-09-10T20:00:00-03:00"), status: "scheduled" }),
    ],
    sources: [eventSource(sourceId)],
    qualityScore: 0.5,
    rankingScore: 0.5,
    firstSeenAt: new Date("2026-01-01T00:00:00Z"),
    lastSeenAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

describe("findCandidatePairs — cross-source blocking", () => {
  it("returns a pair with similar titles, overlapping dates, and different sources", async () => {
    await repository.save(makeEvent("evt-a", "Rock in Porto Alegre", "source-a"));
    await repository.save(makeEvent("evt-b", "Rock in Porto Alegre", "source-b"));

    const pairs = await findCandidatePairs(connection.db);
    expect(pairs).toEqual([{ leftEventId: "evt-a", rightEventId: "evt-b" }]);
  });

  it("never pairs two events that share a source (same-origin duplicates are out of scope)", async () => {
    await repository.save(makeEvent("evt-a", "Rock in Porto Alegre", "source-a"));
    await repository.save(makeEvent("evt-b", "Rock in Porto Alegre", "source-a"));

    const pairs = await findCandidatePairs(connection.db);
    expect(pairs).toEqual([]);
  });
});

describe("findCandidatePairs — temporal blocking", () => {
  it("excludes a pair whose dates don't overlap at all", async () => {
    await repository.save(makeEvent("evt-a", "Rock in Porto Alegre", "source-a"));
    await repository.save(
      makeEvent(
        "evt-b",
        "Rock in Porto Alegre",
        "source-b",
        createTimedEventOccurrence({ id: "evt-b-occ", eventId: "evt-b", startsAt: new Date("2026-12-25T20:00:00-03:00"), status: "scheduled" }),
      ),
    );

    const pairs = await findCandidatePairs(connection.db);
    expect(pairs).toEqual([]);
  });

  it("is permissive across mixed temporal precision (timed vs date-only) — blocking, not final matching", async () => {
    await repository.save(makeEvent("evt-a", "Rock in Porto Alegre", "source-a"));
    await repository.save(
      makeEvent(
        "evt-b",
        "Rock in Porto Alegre",
        "source-b",
        createDateOnlyEventOccurrence({ id: "evt-b-occ", eventId: "evt-b", startDate: "2026-09-10", status: "scheduled" }),
      ),
    );

    const pairs = await findCandidatePairs(connection.db);
    expect(pairs).toEqual([{ leftEventId: "evt-a", rightEventId: "evt-b" }]);
  });
});

describe("findCandidatePairs — textual blocking", () => {
  it("excludes a pair with completely unrelated titles", async () => {
    await repository.save(makeEvent("evt-a", "Rock in Porto Alegre", "source-a"));
    await repository.save(makeEvent("evt-b", "Feira de Artesanato Local", "source-b"));

    const pairs = await findCandidatePairs(connection.db);
    expect(pairs).toEqual([]);
  });

  it("is permissive enough to include a minor title variation (recall-oriented, not the final threshold)", async () => {
    await repository.save(makeEvent("evt-a", "Rock in Porto Alegre 2026", "source-a"));
    await repository.save(makeEvent("evt-b", "Rock in Porto Alegre", "source-b"));

    const pairs = await findCandidatePairs(connection.db);
    expect(pairs).toEqual([{ leftEventId: "evt-a", rightEventId: "evt-b" }]);
  });
});

describe("findCandidatePairs — other invariants", () => {
  it("excludes a cancelled event", async () => {
    await repository.save(makeEvent("evt-a", "Rock in Porto Alegre", "source-a"));
    await repository.save(makeEvent("evt-b", "Rock in Porto Alegre", "source-b", undefined, "cancelled"));

    const pairs = await findCandidatePairs(connection.db);
    expect(pairs).toEqual([]);
  });

  it("returns each pair exactly once, normalized, never both orderings", async () => {
    await repository.save(makeEvent("evt-z", "Rock in Porto Alegre", "source-a"));
    await repository.save(makeEvent("evt-a", "Rock in Porto Alegre", "source-b"));

    const pairs = await findCandidatePairs(connection.db);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toEqual({ leftEventId: "evt-a", rightEventId: "evt-z" });
  });
});
