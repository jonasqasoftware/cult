import { describe, expect, it } from "vitest";
import { createSourceDefinition } from "./types/source-definition.js";
import { evaluateProductionGate } from "./production-data-gate.js";

function sourceWith(commercialUse: "allowed" | "restricted" | "unknown") {
  return createSourceDefinition({
    id: "test-source",
    name: "Test Source",
    type: "api",
    enabled: true,
    pollingIntervalMinutes: 60,
    authorityScore: 0.5,
    commercialUse,
    connector: "test",
  });
}

describe("evaluateProductionGate", () => {
  it("approves a source with commercialUse allowed", () => {
    const decision = evaluateProductionGate(sourceWith("allowed"));
    expect(decision.status).toBe("approved");
  });

  it("blocks a source with commercialUse restricted, with a legal/commercial reason", () => {
    const decision = evaluateProductionGate(sourceWith("restricted"));
    expect(decision.status).toBe("blocked");
    expect(decision.reason).toMatch(/commercial|legal/i);
  });

  it("blocks a source with commercialUse unknown, with a reuse-rights reason", () => {
    const decision = evaluateProductionGate(sourceWith("unknown"));
    expect(decision.status).toBe("blocked");
    expect(decision.reason).toMatch(/reuse|rights/i);
  });

  it("carries the source id through", () => {
    const decision = evaluateProductionGate(sourceWith("allowed"));
    expect(decision.sourceId).toBe("test-source");
  });
});
