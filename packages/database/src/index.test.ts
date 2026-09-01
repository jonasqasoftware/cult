import { describe, expect, it } from "vitest";
import * as database from "./index.js";

describe("@cult/database public exports", () => {
  it("exposes the connection factory and repository factories through the package barrel", () => {
    expect(typeof database.createDatabaseConnection).toBe("function");
    expect(typeof database.createRawEventRepository).toBe("function");
    expect(typeof database.createCanonicalEventRepository).toBe("function");
    expect(typeof database.loadCanonicalEventsByIds).toBe("function");
    expect(typeof database.upsertSource).toBe("function");
  });

  it("exposes the M7 discovery query layer", () => {
    expect(typeof database.discoverEvents).toBe("function");
    expect(typeof database.resolvePeriod).toBe("function");
    expect(typeof database.resolveDateRangeFilter).toBe("function");
    expect(typeof database.encodeCursor).toBe("function");
    expect(typeof database.decodeCursor).toBe("function");
  });

  it("exposes the M9 dedup persistence/suppression layer and ops summary", () => {
    expect(typeof database.normalizePair).toBe("function");
    expect(typeof database.selectRepresentative).toBe("function");
    expect(typeof database.upsertEngineEvaluation).toBe("function");
    expect(typeof database.decideCandidate).toBe("function");
    expect(typeof database.listPendingReview).toBe("function");
    expect(typeof database.getCandidateByPair).toBe("function");
    expect(typeof database.findCandidatePairs).toBe("function");
    expect(typeof database.computeSuppressedEventIds).toBe("function");
    expect(typeof database.computeOpsSummary).toBe("function");
  });
});
