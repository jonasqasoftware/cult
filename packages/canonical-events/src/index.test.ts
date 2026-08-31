import { describe, expect, it } from "vitest";
import * as canonicalEvents from "./index.js";

describe("@cult/canonical-events public exports", () => {
  it("exposes slug generation and the provisional score policy", () => {
    expect(typeof canonicalEvents.generateSlug).toBe("function");
    expect(canonicalEvents.PROVISIONAL_QUALITY_SCORE).toBeGreaterThanOrEqual(0);
    expect(canonicalEvents.PROVISIONAL_QUALITY_SCORE).toBeLessThanOrEqual(1);
    expect(canonicalEvents.PROVISIONAL_RANKING_SCORE).toBeGreaterThanOrEqual(0);
  });
});
