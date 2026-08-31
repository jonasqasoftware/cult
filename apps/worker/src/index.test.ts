import { describe, expect, it, vi } from "vitest";
import { main } from "./index.js";

describe("apps/worker foundation", () => {
  it("logs the foundation message without throwing", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    expect(() => main()).not.toThrow();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("worker foundation is up"));
    logSpy.mockRestore();
  });
});
