import { describe, expect, it } from "vitest";
import { createInMemorySourceRegistry } from "./in-memory-source-registry.js";
import { createSourceDefinition } from "../types/source-definition.js";

describe("createInMemorySourceRegistry", () => {
  const source = createSourceDefinition({
    id: "src-1",
    name: "Test Source",
    type: "api",
    enabled: true,
    pollingIntervalMinutes: 30,
    authorityScore: 0.5,
    commercialUse: "unknown",
    connector: "test-connector",
  });

  it("returns a registered source by id", () => {
    const registry = createInMemorySourceRegistry([source]);
    expect(registry.get("src-1")).toEqual(source);
  });

  it("returns undefined for an unknown source id", () => {
    const registry = createInMemorySourceRegistry([source]);
    expect(registry.get("unknown")).toBeUndefined();
  });

  it("lists all registered sources", () => {
    const registry = createInMemorySourceRegistry([source]);
    expect(registry.list()).toEqual([source]);
  });
});
