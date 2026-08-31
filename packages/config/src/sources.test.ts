import { describe, expect, it } from "vitest";
import { createDevelopmentSourceRegistry, TICKETMASTER_SOURCE_DEFINITION } from "./sources.js";

describe("TICKETMASTER_SOURCE_DEFINITION", () => {
  // Regression guard: this must never silently flip to "allowed" — see
  // docs/sources/ticketmaster.md (Source Legal Gate) and ADR-0013.
  it("is registered with commercialUse restricted, never allowed", () => {
    expect(TICKETMASTER_SOURCE_DEFINITION.commercialUse).toBe("restricted");
  });

  it("has a valid authorityScore and polling interval", () => {
    expect(TICKETMASTER_SOURCE_DEFINITION.authorityScore).toBeGreaterThanOrEqual(0);
    expect(TICKETMASTER_SOURCE_DEFINITION.authorityScore).toBeLessThanOrEqual(1);
    expect(TICKETMASTER_SOURCE_DEFINITION.pollingIntervalMinutes).toBeGreaterThan(0);
  });
});

describe("createDevelopmentSourceRegistry", () => {
  it("registers ticketmaster and only ticketmaster", () => {
    const registry = createDevelopmentSourceRegistry();
    expect(registry.get("ticketmaster")?.id).toBe("ticketmaster");
    expect(registry.list()).toHaveLength(1);
  });
});
