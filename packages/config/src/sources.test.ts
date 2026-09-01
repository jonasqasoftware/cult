import { describe, expect, it } from "vitest";
import {
  ALL_SOURCE_DEFINITIONS,
  createDevelopmentSourceRegistry,
  DESTINO_POA_SOURCE_DEFINITION,
  MANUAL_BETA_SOURCE_DEFINITION,
  TICKETMASTER_SOURCE_DEFINITION,
} from "./sources.js";

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

describe("DESTINO_POA_SOURCE_DEFINITION", () => {
  // Regression guard: this must never silently flip to "allowed" — see
  // docs/sources/destino-poa.md (Source Legal Gate) and ADR-0013.
  it("is registered with commercialUse unknown, never allowed", () => {
    expect(DESTINO_POA_SOURCE_DEFINITION.commercialUse).toBe("unknown");
  });

  it('is typed "crawler", not "api" — no public API was found', () => {
    expect(DESTINO_POA_SOURCE_DEFINITION.type).toBe("crawler");
  });

  it("has a valid authorityScore and polling interval", () => {
    expect(DESTINO_POA_SOURCE_DEFINITION.authorityScore).toBeGreaterThanOrEqual(0);
    expect(DESTINO_POA_SOURCE_DEFINITION.authorityScore).toBeLessThanOrEqual(1);
    expect(DESTINO_POA_SOURCE_DEFINITION.pollingIntervalMinutes).toBeGreaterThan(0);
  });
});

describe("MANUAL_BETA_SOURCE_DEFINITION", () => {
  // M10 section 42 — this is the ONLY source allowed to carry commercialUse: "allowed" out
  // of the box, and only because every event entered through it is human-authorized per
  // docs/sources/manual-beta.md, not because we've relaxed a real provider's licensing.
  it('is registered with type "manual" and commercialUse "allowed"', () => {
    expect(MANUAL_BETA_SOURCE_DEFINITION.type).toBe("manual");
    expect(MANUAL_BETA_SOURCE_DEFINITION.commercialUse).toBe("allowed");
  });
});

describe("ALL_SOURCE_DEFINITIONS", () => {
  it("lists exactly the three known sources", () => {
    expect(ALL_SOURCE_DEFINITIONS.map((source) => source.id).sort()).toEqual([
      "destino-poa",
      "manual-beta",
      "ticketmaster",
    ]);
  });
});

describe("createDevelopmentSourceRegistry", () => {
  it("registers ticketmaster, destino-poa, and manual-beta", () => {
    const registry = createDevelopmentSourceRegistry();
    expect(registry.get("ticketmaster")?.id).toBe("ticketmaster");
    expect(registry.get("destino-poa")?.id).toBe("destino-poa");
    expect(registry.get("manual-beta")?.id).toBe("manual-beta");
    expect(registry.list()).toHaveLength(3);
  });
});
