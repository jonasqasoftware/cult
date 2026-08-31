import { describe, expect, it } from "vitest";
import { createSourceDefinition } from "./source-definition.js";

describe("createSourceDefinition", () => {
  const base = {
    id: "src-1",
    name: "Test Source",
    type: "api" as const,
    enabled: true,
    pollingIntervalMinutes: 30,
    authorityScore: 0.5,
    commercialUse: "unknown" as const,
    connector: "test-connector",
  };

  it("accepts authorityScore of 0", () => {
    expect(createSourceDefinition({ ...base, authorityScore: 0 }).authorityScore).toBe(0);
  });

  it("accepts authorityScore of 1", () => {
    expect(createSourceDefinition({ ...base, authorityScore: 1 }).authorityScore).toBe(1);
  });

  it("rejects authorityScore outside 0..1", () => {
    expect(() => createSourceDefinition({ ...base, authorityScore: 1.1 })).toThrow(
      /authorityScore/,
    );
    expect(() => createSourceDefinition({ ...base, authorityScore: -0.1 })).toThrow(
      /authorityScore/,
    );
  });

  it("rejects pollingIntervalMinutes <= 0", () => {
    expect(() => createSourceDefinition({ ...base, pollingIntervalMinutes: 0 })).toThrow(
      /pollingIntervalMinutes/,
    );
    expect(() => createSourceDefinition({ ...base, pollingIntervalMinutes: -5 })).toThrow(
      /pollingIntervalMinutes/,
    );
  });
});
