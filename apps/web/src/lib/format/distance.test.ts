import { describe, expect, it } from "vitest";
import { formatDistance } from "./distance.js";

describe("formatDistance", () => {
  it("formats sub-kilometer distances in meters, rounded", () => {
    expect(formatDistance(650)).toBe("650 m");
    expect(formatDistance(12)).toBe("12 m");
  });

  it("formats kilometer-scale distances with one decimal", () => {
    expect(formatDistance(1200)).toBe("1,2 km");
    expect(formatDistance(15000)).toBe("15,0 km");
  });
});
