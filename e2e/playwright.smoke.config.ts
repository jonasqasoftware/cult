import { defineConfig, devices } from "@playwright/test";

// M10 section 46 — a smoke suite for a CONFIGURABLE, already-running environment (local dev,
// staging, or production), distinct from the main playwright.config.ts (which owns starting
// the local dev stack for the full E2E suite in CI). No webServer here: this config assumes
// SMOKE_BASE_URL is already reachable. Every test in smoke.spec.ts is read-only — it never
// writes to the database or calls the dedup:scan CLI (M10: "não alterar dados em production
// public").
const BASE_URL = process.env["SMOKE_BASE_URL"] ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  testMatch: "smoke.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
