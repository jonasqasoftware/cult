import { describe, expect, it } from "vitest";
import { performerOverlap } from "./performer.js";
import type { Performer } from "@cult/domain";

function performer(name: string): Performer {
  return { id: "x", name };
}

describe("performerOverlap", () => {
  it("is undefined when either side has no performers listed", () => {
    expect(performerOverlap([], [performer("DJ Lua")])).toBeUndefined();
    expect(performerOverlap([performer("DJ Lua")], [])).toBeUndefined();
  });

  it("is 1 for the exact same performer name", () => {
    expect(performerOverlap([performer("DJ Lua")], [performer("DJ Lua")])).toBe(1);
  });

  it("is high when one side adds a companion act to the same base name", () => {
    const result = performerOverlap([performer("Duo Sul")], [performer("Duo Sul e Banda")]);
    expect(result).toBeGreaterThanOrEqual(0.8);
  });

  it("is 0 for entirely different performers", () => {
    expect(performerOverlap([performer("DJ Lua")], [performer("MC Sul")])).toBe(0);
  });

  it("reflects partial overlap between two performer lists", () => {
    const result = performerOverlap(
      [performer("Banda Exemplo"), performer("DJ Lua")],
      [performer("Banda Exemplo")],
    );
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });
});
