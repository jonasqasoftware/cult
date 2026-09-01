import { expect, test } from "@playwright/test";

// M8 section 66: never assert on tile rendering or MapLibre internals — only the product
// behavior (toggle works, the map container exists, geolocated events produce something
// clickable, the list stays reachable). Never depends on the external OSM tile server being
// reachable in CI.
test("toggling from Lista to Mapa shows a map container, and the list stays reachable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mapa" }).click();
  await expect(page.getByRole("application", { name: "Mapa dos eventos" })).toBeVisible();

  await page.getByRole("button", { name: "Lista" }).click();
  await expect(page.getByRole("list", { name: "Lista de eventos" })).toBeVisible();
});

test("a geolocated event produces a marker whose popup links to its detail page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Mapa" }).click();
  const mapContainer = page.getByRole("application", { name: "Mapa dos eventos" });
  await expect(mapContainer).toBeVisible();

  const marker = mapContainer.locator(".maplibregl-marker");
  await expect(marker).toHaveCount(1, { timeout: 10_000 });
  await marker.click();
  await expect(page.getByRole("link", { name: "Rock in Porto Alegre" })).toBeVisible();
});

// M10.2 Phase C — regression for a bug the "Fim de semana + Grátis" stale-filter fix
// (filter-composition.spec.ts) accidentally reintroduced: ResultsView used to hold both the
// query-bound result set AND the user's Lista/Mapa preference in one `useState` set, so keying
// the whole component on the filters (to fix stale results) also reset the view toggle back to
// "Lista" on every filter change. Fixed by splitting query-bound state (QueryResults, which
// remounts) from view-preference state (ResultsView, which doesn't) — see ResultsView.tsx.
test("applying a filter while in Mapa view does not bounce back to Lista", async ({ page }) => {
  await page.goto("/");
  const mapaButton = page.getByRole("button", { name: "Mapa" });
  const listaButton = page.getByRole("button", { name: "Lista" });
  await mapaButton.click();
  await expect(mapaButton).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("application", { name: "Mapa dos eventos" })).toBeVisible();

  await page.getByRole("link", { name: "Grátis", exact: true }).click();
  await expect(page).toHaveURL(/free=true/);

  // The regression: without the fix, ResultsView remounts entirely on the filter change and
  // silently resets to view === "list" here.
  await expect(mapaButton).toHaveAttribute("aria-pressed", "true");
  await expect(listaButton).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("application", { name: "Mapa dos eventos" })).toBeVisible();
});

test("the map's markers reflect the current filter, not a stale query", async ({ page }) => {
  // "Rock in Porto Alegre" (R$80-350, not free) is the one reliably geotagged golden-fixture
  // event — see the marker-count test above. Filtering to free=true must remove its marker,
  // proving the remounted QueryResults fetched fresh data rather than just filtering the
  // already-rendered map in place (or, worse, leaving the previous query's marker on screen).
  await page.goto("/");
  await page.getByRole("button", { name: "Mapa" }).click();
  const mapContainer = page.getByRole("application", { name: "Mapa dos eventos" });
  await expect(mapContainer).toBeVisible();
  await expect(mapContainer.locator(".maplibregl-marker")).toHaveCount(1, { timeout: 10_000 });

  await page.getByRole("link", { name: "Grátis", exact: true }).click();
  await expect(page).toHaveURL(/free=true/);
  await expect(page.getByRole("application", { name: "Mapa dos eventos" })).toBeVisible();
  await expect(mapContainer.locator(".maplibregl-marker")).toHaveCount(0, { timeout: 10_000 });
});

test("Perto de mim requests geolocation and reflects it in the URL", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: -30.0654, longitude: -51.2354 });

  await page.goto("/");
  await page.getByRole("button", { name: "Perto de mim" }).click();
  await expect(page).toHaveURL(/lat=-30\.0654/);
  await expect(page).toHaveURL(/lng=-51\.2354/);
  await expect(page.getByText("Rock in Porto Alegre").first()).toBeVisible();
});

test("Perto de mim stays fully usable when geolocation is denied", async ({ page }) => {
  // A fresh context (Playwright's default, per test) with no geolocation permission granted —
  // Chromium auto-denies the request rather than showing a native prompt in automated runs.
  await page.goto("/");
  await page.getByRole("button", { name: "Perto de mim" }).click();
  // The home page also has its own "N eventos carregados" status region, so this is scoped to
  // the specific visible notice paragraph rather than role=status (ambiguous here).
  await expect(page.locator("p", { hasText: "Não foi possível usar sua localização." })).toBeVisible();
  // The rest of the product stays usable — no crash, filters still present.
  await expect(page.getByRole("link", { name: "Hoje", exact: true })).toBeVisible();
});
