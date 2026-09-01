import { defineConfig, devices } from "@playwright/test";

// M8 sections 61-66: real stack (Postgres -> fixtures -> Fastify API -> Next Web -> Playwright),
// not a mocked API. This config only starts the two servers; migrations/fixture ingestion are
// a separate, explicit step (pnpm db:migrate + pnpm ingest:*:fixture) run before `pnpm e2e` —
// see apps/web/README.md "E2E" and package.json's `e2e` script.
const WEB_PORT = process.env["WEB_PORT"] ?? "3000";
const API_PORT = process.env["API_PORT"] ?? "3001";
const DATABASE_URL = process.env["DATABASE_URL"] ?? "postgresql://cult:cult@localhost:5432/cult";
const WEB_BASE_URL = `http://localhost:${WEB_PORT}`;
const API_BASE_URL = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: "./tests",
  // smoke.spec.ts targets a configurable, already-running environment (M10 section 46) via
  // playwright.smoke.config.ts / `pnpm e2e:smoke` — kept out of this suite so it isn't run
  // twice against two different configs by a plain `pnpm e2e`.
  testIgnore: "smoke.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"]
    ? [["github"], ["html", { open: "never", outputFolder: "../playwright-report" }]]
    : "list",
  use: {
    baseURL: WEB_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @cult/api run start",
      cwd: "..",
      url: `${API_BASE_URL}/health`,
      timeout: 30_000,
      reuseExistingServer: !process.env["CI"],
      env: { DATABASE_URL, API_PORT },
    },
    {
      command: "pnpm --filter @cult/web run start",
      cwd: "..",
      url: WEB_BASE_URL,
      timeout: 30_000,
      reuseExistingServer: !process.env["CI"],
      env: {
        CULT_API_BASE_URL: API_BASE_URL,
        NEXT_PUBLIC_SITE_URL: WEB_BASE_URL,
        WEB_PORT,
      },
    },
  ],
});
