import { describe, expect, it } from "vitest";
import { geoDistanceMeters, geoSimilarity } from "./geo.js";

describe("geoDistanceMeters", () => {
  it("is 0 for identical coordinates", () => {
    const point = { latitude: -30.0346, longitude: -51.2177 };
    expect(geoDistanceMeters(point, point)).toBeCloseTo(0, 1);
  });

  it("is undefined when either point lacks coordinates", () => {
    expect(geoDistanceMeters({}, { latitude: -30, longitude: -51 })).toBeUndefined();
    expect(geoDistanceMeters({ latitude: -30, longitude: -51 }, {})).toBeUndefined();
  });

  it("computes a plausible distance for two known Porto Alegre points ~1.5km apart", () => {
    // Praça da Alfândega vs Usina do Gasômetro — roughly 1.3-1.7km apart in reality.
    const a = { latitude: -30.0304, longitude: -51.2277 };
    const b = { latitude: -30.0298, longitude: -51.2422 };
    const distance = geoDistanceMeters(a, b);
    expect(distance).toBeGreaterThan(1000);
    expect(distance).toBeLessThan(2000);
  });
});

describe("geoSimilarity", () => {
  it("is 1 for zero distance", () => {
    expect(geoSimilarity(0)).toBe(1);
  });

  it("decreases as distance grows", () => {
    expect(geoSimilarity(100)).toBeGreaterThan(geoSimilarity(500));
    expect(geoSimilarity(500)).toBeGreaterThan(geoSimilarity(2000));
  });

  it("floors at 0 for very large distances", () => {
    expect(geoSimilarity(50000)).toBe(0);
  });
});
