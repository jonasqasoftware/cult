import { describe, expect, it } from "vitest";
import { buildEventSlug, generateSlug } from "./slug.js";

describe("generateSlug", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(generateSlug("Rock in Porto Alegre")).toBe("rock-in-porto-alegre");
  });

  it("strips accents", () => {
    expect(generateSlug("Exposição de Fotografia")).toBe("exposicao-de-fotografia");
  });

  it("collapses non-alphanumeric runs into a single hyphen", () => {
    expect(generateSlug("Show!! @ Praça  --  Central")).toBe("show-praca-central");
  });

  it("trims leading and trailing hyphens", () => {
    expect(generateSlug("  -- Teatro -- ")).toBe("teatro");
  });
});

describe("buildEventSlug", () => {
  it("is deterministic for the same (title, sourceId, externalId)", () => {
    const first = buildEventSlug("Show de Rock", "ticketmaster", "TM-1");
    const second = buildEventSlug("Show de Rock", "ticketmaster", "TM-1");
    expect(first).toBe(second);
  });

  it("disambiguates two events that share the exact same title", () => {
    const eventA = buildEventSlug("Show de Rock", "ticketmaster", "TM-1");
    const eventB = buildEventSlug("Show de Rock", "ticketmaster", "TM-2");
    expect(eventA).not.toBe(eventB);
    expect(eventA.startsWith("show-de-rock-")).toBe(true);
    expect(eventB.startsWith("show-de-rock-")).toBe(true);
  });

  it("never produces an empty slug, even for an all-symbol title", () => {
    const slug = buildEventSlug("!!!", "ticketmaster", "TM-3");
    expect(slug.length).toBeGreaterThan(0);
  });
});
