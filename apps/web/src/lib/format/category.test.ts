import { describe, expect, it } from "vitest";
import { presentCategoryLabel, presentCategoryLabelFromId } from "./category.js";

describe("presentCategoryLabel", () => {
  it("translates a known category id to a pt-BR label", () => {
    expect(presentCategoryLabel({ id: "music", name: "music", slug: "music" })).toBe("Música");
  });

  it("translates other known ids observed from real sources", () => {
    expect(presentCategoryLabel({ id: "cinema", name: "cinema", slug: "cinema" })).toBe("Cinema");
    expect(presentCategoryLabel({ id: "gastronomia", name: "gastronomia", slug: "gastronomia" })).toBe(
      "Gastronomia",
    );
  });

  it("falls back safely to the API-provided name for an unknown id, never inventing a translation", () => {
    expect(presentCategoryLabel({ id: "some-new-id", name: "some-new-id", slug: "some-new-id" })).toBe(
      "some-new-id",
    );
  });
});

describe("presentCategoryLabelFromId", () => {
  it("translates a known id given as a bare string (no full Category object needed)", () => {
    expect(presentCategoryLabelFromId("music")).toBe("Música");
  });

  // M10.2 Phase B — these three surfaced as raw technical slugs during the UI Demo Dataset's
  // manual review (docs/quality/UI_DEMO_DATASET.md); purely presentational additions, never a
  // new taxonomy and never a change to what's sent to/received from the API.
  it("translates the labels added for the UI Demo Dataset review", () => {
    expect(presentCategoryLabelFromId("exposicao")).toBe("Exposição");
    expect(presentCategoryLabelFromId("teatro-e-artes")).toBe("Teatro e Artes");
    expect(presentCategoryLabelFromId("passeio-cultural")).toBe("Passeio Cultural");
  });

  it("falls back to the raw id itself for an unknown id", () => {
    expect(presentCategoryLabelFromId("some-new-id")).toBe("some-new-id");
    expect(presentCategoryLabelFromId("categoria-desconhecida")).toBe("categoria-desconhecida");
  });
});
