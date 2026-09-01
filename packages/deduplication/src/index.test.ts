import { describe, expect, it } from "vitest";
import * as deduplication from "./index.js";

describe("@cult/deduplication public exports", () => {
  it("exposes golden dataset loading, validation and summary tooling", () => {
    expect(typeof deduplication.loadGoldenDataset).toBe("function");
    expect(typeof deduplication.loadDedupCases).toBe("function");
    expect(typeof deduplication.validateGoldenDataset).toBe("function");
    expect(typeof deduplication.summarizeGoldenDataset).toBe("function");
    expect(deduplication.CRITICAL_CONFLICT_VOCABULARY.length).toBeGreaterThan(0);
  });

  it("exposes the in-memory deduplication engine (M6): assessment, signals and evaluation", () => {
    expect(typeof deduplication.assessDuplicate).toBe("function");
    expect(typeof deduplication.detectConflicts).toBe("function");
    expect(typeof deduplication.computeScore).toBe("function");
    expect(typeof deduplication.decideRouting).toBe("function");

    expect(typeof deduplication.textSimilarity).toBe("function");
    expect(typeof deduplication.titleSimilarity).toBe("function");
    expect(typeof deduplication.assessVenueText).toBe("function");
    expect(typeof deduplication.geoDistanceMeters).toBe("function");
    expect(typeof deduplication.assessTemporal).toBe("function");
    expect(typeof deduplication.performerOverlap).toBe("function");
    expect(typeof deduplication.assessUrl).toBe("function");

    expect(typeof deduplication.isHoldoutCase).toBe("function");
    expect(typeof deduplication.computeMetrics).toBe("function");
    expect(typeof deduplication.evaluateCases).toBe("function");
    expect(typeof deduplication.selectPartition).toBe("function");
  });
});
