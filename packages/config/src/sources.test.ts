import { describe, expect, it } from "vitest";
import {
  createDevelopmentSourceRegistry,
  DESTINO_POA_SOURCE_DEFINITION,
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

describe("createDevelopmentSourceRegistry", () => {
  it("registers both ticketmaster and destino-poa", () => {
    const registry = createDevelopmentSourceRegistry();
    expect(registry.get("ticketmaster")?.id).toBe("ticketmaster");
    expect(registry.get("destino-poa")?.id).toBe("destino-poa");
    expect(registry.list()).toHaveLength(2);
  });
});
