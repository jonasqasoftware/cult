import { describe, expect, it } from "vitest";
import { generateSlug } from "./slug.js";

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
