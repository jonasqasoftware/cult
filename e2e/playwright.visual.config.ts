import { defineConfig, devices } from "@playwright/test";

// M10.1 section 18/27/29 — a small, separate visual-regression suite. Kept out of
// playwright.config.ts (option B from section 29: "ser job separado obrigatório") so a
// screenshot-baseline diff — which is far more environment-sensitive than a functional
// assertion — never blocks or gets blocked by the main functional E2E signal. Reuses the
// same real local stack (Postgres -> fixtures -> Fastify API -> Next Web) as the main config;
// only the test selection and snapshot options differ.
//
// Each visual test sets its own viewport explicitly (section 27's documented acceptable
// alternative to a `ui-desktop`/`ui-mobile` project split) rather than multiplying the whole
// suite across projects for what is currently four baselines.
const WEB_PORT = process.env["WEB_PORT"] ?? "3000";
const API_PORT = process.env["API_PORT"] ?? "3001";
const DATABASE_URL = process.env["DATABASE_URL"] ?? "postgresql://cult:cult@localhost:5432/cult";
const WEB_BASE_URL = `http://localhost:${WEB_PORT}`;
const API_BASE_URL = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "visual-smoke.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  // Section 29 — never auto-update a baseline on failure; a visual diff always needs a human
  // decision (re-run locally with --update-snapshots and review the diff, or fix the
  // regression). Retries wouldn't change that, but a real screenshot render can be marginally
  // flaky on the very first run (fonts/webfont-swap) — one retry only smooths that, it never
  // silently accepts a genuine visual difference (a real diff reproduces identically).
  retries: process.env["CI"] ? 1 : 0,
  reporter: process.env["CI"]
    ? [["github"], ["html", { open: "never", outputFolder: "../playwright-visual-report" }]]
    : "list",
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01 },
  },
  use: {
    baseURL: WEB_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
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
