import { describe, expect, it } from "vitest";
import * as deduplication from "./index.js";

describe("@cult/deduplication public exports", () => {
  it("exposes golden dataset loading, validation and summary tooling — no matching engine", () => {
    expect(typeof deduplication.loadGoldenDataset).toBe("function");
    expect(typeof deduplication.loadDedupCases).toBe("function");
    expect(typeof deduplication.validateGoldenDataset).toBe("function");
    expect(typeof deduplication.summarizeGoldenDataset).toBe("function");
    expect(deduplication.CRITICAL_CONFLICT_VOCABULARY.length).toBeGreaterThan(0);
  });
});
