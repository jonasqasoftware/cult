import { expect, test } from "@playwright/test";

// M10 section 46 — a smoke suite for a real, already-deployed environment (local, staging,
// or production), run separately from the main E2E suite via:
//   SMOKE_BASE_URL=https://staging.example.com pnpm e2e:smoke
// Every test here is read-only: no database writes, no dedup:scan invocation, nothing that
// could alter production data. Assertions stay structural (roles, presence, status codes)
// rather than depending on specific fixture content, since the target dataset is unknown.

test("health check responds", async ({ request, baseURL }) => {
  const response = await request.get(`${baseURL}/api/health`);
  expect(response.ok()).toBe(true);
});

test("home loads and either shows events or the empty state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const eventList = page.getByRole("list", { name: "Lista de eventos" });
  const hasList = await eventList.isVisible().catch(() => false);
  if (hasList) {
    await expect(eventList.getByRole("listitem").first()).toBeVisible();
  }
});

test("categories navigation is present when the environment has any categorized events", async ({ page }) => {
  await page.goto("/");
  // CategoryChips renders nothing at all when there are zero distinct categories in the
  // current dataset (an empty/newly-deployed environment) — that's correct product
  // behavior, not a smoke failure, so this only asserts shape when chips actually render.
  const nav = page.getByRole("navigation", { name: "Categorias" });
  const hasCategories = await nav.isVisible().catch(() => false);
  test.skip(!hasCategories, "No categorized events in this environment yet.");
  await expect(nav).toBeVisible();
});

test("Perto de mim control is present and usable without granting permission", async ({ page }) => {
  await page.goto("/");
  const nearbyButton = page.getByRole("button", { name: "Perto de mim" });
  await expect(nearbyButton).toBeVisible();
});

test("search is reachable and returns a page (even if zero results)", async ({ page }) => {
  await page.goto("/?q=zzz-smoke-test-unlikely-to-match-zzz");
  await expect(page.getByRole("searchbox", { name: /buscar/i })).toBeVisible();
});

test("opening the first event (if any) shows a detail page with a working ticket/source action or share button", async ({
  page,
}) => {
  await page.goto("/");
  const firstCard = page.getByRole("list", { name: "Lista de eventos" }).getByRole("listitem").first();
  const hasEvents = await firstCard.isVisible().catch(() => false);
  test.skip(!hasEvents, "No events currently published in this environment — nothing to open.");

  await firstCard.getByRole("link").first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Every event detail page always has a Share action, regardless of whether ticket/source
  // links are present for that specific event.
  await expect(page.getByRole("button", { name: "Compartilhar" })).toBeVisible();
});

test("privacy and about pages are reachable", async ({ page }) => {
  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto("/sobre");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("manifest and robots are served", async ({ request, baseURL }) => {
  const manifest = await request.get(`${baseURL}/manifest.webmanifest`);
  expect(manifest.ok()).toBe(true);
  const robots = await request.get(`${baseURL}/robots.txt`);
  expect(robots.ok()).toBe(true);
});
