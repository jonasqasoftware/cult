import { describe, expect, it } from "vitest";
import { normalizeText, textSimilarity, tokenize } from "./text.js";

describe("normalizeText", () => {
  it("lowercases", () => {
    expect(normalizeText("ROCK EM POA")).toBe("rock em poa");
  });

  it("strips diacritics", () => {
    expect(normalizeText("João")).toBe(normalizeText("Joao"));
  });

  it("strips punctuation", () => {
    expect(normalizeText("Rock & Blues — POA")).toBe("rock blues poa");
  });

  it("collapses whitespace", () => {
    expect(normalizeText("Rock   em    POA")).toBe(normalizeText("Rock em POA"));
  });
});

describe("tokenize", () => {
  it("splits normalized text on whitespace", () => {
    expect(tokenize("Festival do Guaíba")).toEqual(["festival", "do", "guaiba"]);
  });

  it("returns an empty array for an empty/whitespace-only string", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("textSimilarity", () => {
  it("is 1 for identical strings", () => {
    expect(textSimilarity("Festival do Guaíba", "Festival do Guaíba")).toBe(1);
  });

  it("is 1 for case-only differences", () => {
    expect(textSimilarity("Festival do Guaíba", "festival do guaíba")).toBe(1);
  });

  it("is 1 for accent-only differences", () => {
    expect(textSimilarity("Sarau Joao Cabral", "Sarau João Cabral")).toBe(1);
  });

  it("is high when one title fully contains the other's words (editorial suffix)", () => {
    const similarity = textSimilarity("Festival do Guaíba", "Festival do Guaíba | Porto Alegre");
    expect(similarity).toBeGreaterThanOrEqual(0.9);
  });

  it("is low for unrelated strings", () => {
    expect(textSimilarity("Sarau de Poesia", "Oficina de Cerâmica")).toBeLessThan(0.3);
  });

  it("is 0 when either string is empty", () => {
    expect(textSimilarity("", "Something")).toBe(0);
  });
});
