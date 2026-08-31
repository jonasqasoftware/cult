import { describe, expect, it } from "vitest";
import { loadAppEnv } from "./env.js";

describe("loadAppEnv", () => {
  it("throws when DATABASE_URL is missing", () => {
    expect(() => loadAppEnv({})).toThrow(/DATABASE_URL/);
  });

  it("applies defaults for optional variables", () => {
    const env = loadAppEnv({ DATABASE_URL: "postgresql://x" });
    expect(env.nodeEnv).toBe("development");
    expect(env.apiPort).toBe(3001);
    expect(env.ticketmasterApiKey).toBeUndefined();
  });

  it("reads provided values, including an optional TICKETMASTER_API_KEY", () => {
    const env = loadAppEnv({
      DATABASE_URL: "postgresql://x",
      NODE_ENV: "test",
      API_PORT: "4000",
      TICKETMASTER_API_KEY: "k",
    });
    expect(env.nodeEnv).toBe("test");
    expect(env.apiPort).toBe(4000);
    expect(env.ticketmasterApiKey).toBe("k");
  });
});
