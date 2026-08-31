import { describe, expect, it } from "vitest";

describe("@cult/canonical-events (M0 scaffold)", () => {
  it("loads as a module without implementation", async () => {
    const mod = await import("./index.js");
    expect(mod).toBeDefined();
  });
});
