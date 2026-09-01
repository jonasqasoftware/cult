import { describe, expect, it } from "vitest";
import { createSourceDefinition } from "@cult/domain";
import { checkProductionSourceAllowed } from "./production-source-gate.js";

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

describe("checkProductionSourceAllowed", () => {
  it("allows any source outside production, regardless of commercialUse", () => {
    expect(checkProductionSourceAllowed("development", sourceWith("restricted")).allowed).toBe(true);
    expect(checkProductionSourceAllowed("staging", sourceWith("unknown")).allowed).toBe(true);
    expect(checkProductionSourceAllowed("test", sourceWith("restricted")).allowed).toBe(true);
  });

  it("allows a production-gate-approved source in production", () => {
    const result = checkProductionSourceAllowed("production", sourceWith("allowed"));
    expect(result.allowed).toBe(true);
  });

  it("blocks a restricted source in production with a clear reason, fail-closed", () => {
    const result = checkProductionSourceAllowed("production", sourceWith("restricted"));
    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error("expected blocked");
    expect(result.reason).toMatch(/production/i);
  });

  it("blocks an unknown-commercialUse source in production", () => {
    const result = checkProductionSourceAllowed("production", sourceWith("unknown"));
    expect(result.allowed).toBe(false);
  });
});
