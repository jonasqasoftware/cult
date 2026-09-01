import { describe, expect, it } from "vitest";
import { titleSimilarity } from "./title.js";

describe("titleSimilarity", () => {
  it("is 1 for identical titles", () => {
    expect(titleSimilarity("Festival Jazz do Guaíba", "Festival Jazz do Guaíba")).toBe(1);
  });

  it("is high for an editorial suffix", () => {
    expect(titleSimilarity("Festival do Guaíba", "Festival do Guaíba | Porto Alegre")).toBeGreaterThanOrEqual(0.9);
  });

  it("is low for unrelated titles", () => {
    expect(titleSimilarity("Sarau de Poesia", "Oficina de Cerâmica")).toBeLessThan(0.3);
  });
});
