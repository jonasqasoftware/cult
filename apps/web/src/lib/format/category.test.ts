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

  it("falls back to the raw id itself for an unknown id", () => {
    expect(presentCategoryLabelFromId("some-new-id")).toBe("some-new-id");
  });
});
