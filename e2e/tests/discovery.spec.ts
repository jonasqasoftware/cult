import { expect, test } from "@playwright/test";

// M8 section 64: "Hoje"/"Fim de semana" only ever assert the URL/request succeeds, never
// specific event content — the fixture dataset's dates are fixed, but the real clock moves,
// so asserting "these specific events show up for period=today" would eventually go stale or
// flake depending on when the suite runs. Content assertions instead use a fixed custom
// start/end range (M8's own recommended workaround, section 64) and free/category/q filters,
// which are deterministic regardless of the real date.

test("home loads and shows event cards", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /descubra o que fazer/i })).toBeVisible();
  const eventList = page.getByRole("list", { name: "Lista de eventos" });
  await expect(eventList.getByRole("listitem").first()).toBeVisible();
});

test("Hoje shortcut updates the URL and still renders successfully", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Hoje", exact: true }).click();
  await expect(page).toHaveURL(/period=today/);
  await expect(page.getByRole("heading", { name: "Eventos" })).toBeVisible();
});

test("Fim de semana shortcut updates the URL and still renders successfully", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Fim de semana", exact: true }).click();
  await expect(page).toHaveURL(/period=weekend/);
  await expect(page.getByRole("heading", { name: "Eventos" })).toBeVisible();
});

test("Grátis shortcut filters to only free events", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Grátis", exact: true }).click();
  await expect(page).toHaveURL(/free=true/);
  await expect(page.getByText("Feira Gratuita do Centro")).toBeVisible();
});

test("search finds an event by title", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("searchbox", { name: /buscar eventos/i }).fill("Rock");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/q=Rock/);
  await expect(page.getByText("Rock in Porto Alegre").first()).toBeVisible();
});

test("search shows the empty state for a term that matches nothing", async ({ page }) => {
  await page.goto("/?q=zzznaoexisteevento");
  await expect(page.getByText("Nenhum evento encontrado com esses filtros.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Limpar filtros" })).toBeVisible();
});

test("a category chip filters results and reflects in the URL", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Categorias" }).getByRole("link", { name: "Cinema", exact: true }).click();
  await expect(page).toHaveURL(/category=cinema/);
  await expect(page.getByText("Festival de Cinema Independente de Porto Alegre")).toBeVisible();
});

test("a custom date range only shows events overlapping it", async ({ page }) => {
  await page.goto("/?start=2026-09-01&end=2026-09-30");
  await expect(page.getByText("Exposição Arte Gaúcha Contemporânea")).toBeVisible();
  await expect(page.getByText("Rock in Porto Alegre").first()).not.toBeVisible();
});

// M10.1: the "Fim de semana then Grátis" regression and further filter-composition
// regressions now live in filter-composition.spec.ts, alongside category/search composition,
// clear-filter, browser-back, and load-more-then-filter tests covering the same underlying
// ResultsView bug class.

test("Carregar mais appends a further page of results without navigating away", async ({ page }) => {
  await page.goto("/");
  const eventList = page.getByRole("list", { name: "Lista de eventos" });
  const initialCount = await eventList.getByRole("listitem").count();
  const loadMore = page.getByRole("button", { name: "Carregar mais" });
  await expect(loadMore).toBeVisible();
  await loadMore.click();
  // Not a fixed "+1": the exact remainder depends on how many golden-fixture events exist
  // (deliberately not hardcoded here — see filter-composition.spec.ts's load-more test for the
  // one place a fixture-derived exact count is meaningful and justified).
  await expect
    .poll(() => eventList.getByRole("listitem").count(), { timeout: 10_000 })
    .toBeGreaterThan(initialCount);
  await expect(page).toHaveURL("/"); // still the same page — client-side append, not a navigation
});
