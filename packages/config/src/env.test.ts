import { writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { loadAppEnv, loadDotEnvIfPresent } from "./env.js";

describe("loadAppEnv", () => {
  it("throws when DATABASE_URL is missing", () => {
    expect(() => loadAppEnv({})).toThrow(/DATABASE_URL/);
  });

  it("applies defaults for optional variables", () => {
    const env = loadAppEnv({ DATABASE_URL: "postgresql://x" });
    expect(env.nodeEnv).toBe("development");
    expect(env.apiPort).toBe(3001);
    expect(env.ticketmasterApiKey).toBeUndefined();
    expect(env.ticketmasterLivePersistAck).toBe(false);
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

  it('only treats an exact "true" as an acknowledged live-persist gate', () => {
    expect(
      loadAppEnv({ DATABASE_URL: "postgresql://x", TICKETMASTER_LIVE_PERSIST_ACK: "true" })
        .ticketmasterLivePersistAck,
    ).toBe(true);
    expect(
      loadAppEnv({ DATABASE_URL: "postgresql://x", TICKETMASTER_LIVE_PERSIST_ACK: "yes" })
        .ticketmasterLivePersistAck,
    ).toBe(false);
  });

  // M10 section 9 — CULT_ENV formalizes development/test/staging/production distinctly from
  // NODE_ENV (which many libraries also read/set for unrelated reasons). Defaults to
  // "development" so every existing local/CI flow keeps working unmodified.
  it("defaults cultEnv to development when CULT_ENV is unset", () => {
    expect(loadAppEnv({ DATABASE_URL: "postgresql://x" }).cultEnv).toBe("development");
  });

  it.each(["development", "test", "staging", "production"])("accepts CULT_ENV=%s", (value) => {
    expect(loadAppEnv({ DATABASE_URL: "postgresql://x", CULT_ENV: value }).cultEnv).toBe(value);
  });

  it("fails startup on an invalid CULT_ENV value rather than silently defaulting it", () => {
    expect(() => loadAppEnv({ DATABASE_URL: "postgresql://x", CULT_ENV: "prod" })).toThrow(/CULT_ENV/);
  });
});

describe("loadDotEnvIfPresent", () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const tempEnvName = ".env.loadDotEnvIfPresent.test";
  const tempEnvPath = path.join(repoRoot, tempEnvName);

  afterEach(() => {
    delete process.env["LOAD_DOT_ENV_TEST_VAR"];
    rmSync(tempEnvPath, { force: true });
  });

  it("does not throw when the file is missing", () => {
    expect(() => loadDotEnvIfPresent(".env.definitely-does-not-exist")).not.toThrow();
  });

  it("loads variables from an existing file at the repo root", () => {
    writeFileSync(tempEnvPath, "LOAD_DOT_ENV_TEST_VAR=hello\n");
    loadDotEnvIfPresent(tempEnvName);
    expect(process.env["LOAD_DOT_ENV_TEST_VAR"]).toBe("hello");
  });
});
