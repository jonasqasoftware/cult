import { expect, test } from "@playwright/test";

// M10.1 sections 2-6. Every test here follows the same three-part shape the root-cause fix
// requires going forward — not just a URL assertion, but also what the user actually sees:
//
//   query state assertion   (the URL reflects the active filters)
//   + visible result        (an event that SHOULD match is rendered)
//   + excluded result       (an event that should NOT match is absent)
//
// A test that only checks the URL would have passed even with the original ResultsView bug
// (the URL updated correctly; only the rendered card list was stale) — see discovery.spec.ts's
// existing period-shortcut tests for the (deliberately URL-only) exception, justified there by
// period tests being real-clock-dependent, not by this being an acceptable general pattern.

test("Weekend + Grátis: composing two filters shows their intersection, with correct aria-pressed state on both controls", async ({
  page,
}) => {
  // Regression test for the original bug: ResultsView is a Client Component preserved across
  // App Router navigations. Its internal `useState(initialEvents)` must not keep rendering
  // results from a previous filter combination once new SSR props arrive — the real reported
  // bug was reaching this exact state by clicking two filter links in a row without a full
  // page reload in between.
  await page.goto("/");

  const weekendLink = page.getByRole("link", { name: "Fim de semana", exact: true });
  await weekendLink.click();
  await expect(page).toHaveURL(/period=weekend/);
  await expect(weekendLink).toHaveAttribute("aria-pressed", "true");

  const freeLink = page.getByRole("link", { name: "Grátis", exact: true });
  await freeLink.click();
  await expect(page).toHaveURL(/free=true/);
  await expect(page).toHaveURL(/period=weekend/);
  // Both controls must reflect the compound query — not just the one just clicked.
  await expect(freeLink).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: "Fim de semana", exact: true })).toHaveAttribute("aria-pressed", "true");

  await expect(page.getByText("Exposição Arte Gaúcha Contemporânea")).toBeVisible();
  await expect(page.getByText("Virada Cultural Porto Alegre")).not.toBeVisible();
});

test("Categoria + Grátis: composing filters excludes a same-category non-free event", async ({ page }) => {
  // "Virada Cultural Porto Alegre" and "Exposição Arte Gaúcha Contemporânea" share the same
  // categoryId ("cultural" — both list "Cultural" as their first Destino POA category) but
  // differ on `free` — a real same-category free/non-free pair from the golden fixtures.
  await page.goto("/");
  await page.getByRole("navigation", { name: "Categorias" }).getByRole("link", { name: "Cultural", exact: true }).click();
  await expect(page).toHaveURL(/category=cultural/);
  await expect(page.getByText("Virada Cultural Porto Alegre")).toBeVisible();
  await expect(page.getByText("Exposição Arte Gaúcha Contemporânea")).toBeVisible();

  await page.getByRole("link", { name: "Grátis", exact: true }).click();
  await expect(page).toHaveURL(/free=true/);
  await expect(page).toHaveURL(/category=cultural/);
  await expect(page.getByText("Exposição Arte Gaúcha Contemporânea")).toBeVisible();
  await expect(page.getByText("Virada Cultural Porto Alegre")).not.toBeVisible();
});

test("Busca + Grátis: a search term matching both a free and a non-free event is narrowed by the free filter", async ({
  page,
}) => {
  // "Porto Alegre" appears in several titles across both free and non-free events — a search
  // term alone isn't enough to prove composition; adding free=true must narrow it further.
  await page.goto("/");
  await page.getByRole("searchbox", { name: /buscar eventos/i }).fill("Porto Alegre");
  await page.getByRole("button", { name: "Buscar" }).click();
  await expect(page).toHaveURL(/q=Porto/);
  await expect(page.getByText("Virada Cultural Porto Alegre")).toBeVisible();
  await expect(page.getByText("Rock in Porto Alegre").first()).toBeVisible();

  await page.getByRole("link", { name: "Grátis", exact: true }).click();
  await expect(page).toHaveURL(/free=true/);
  await expect(page.getByText("Feira do Livro de Porto Alegre")).toBeVisible();
  await expect(page.getByText("Virada Cultural Porto Alegre")).not.toBeVisible();
  await expect(page.getByText("Rock in Porto Alegre")).not.toBeVisible();
});

test("clearing one filter (toggling it off) updates results without needing the other filter to change", async ({
  page,
}) => {
  await page.goto("/");
  const freeLink = page.getByRole("link", { name: "Grátis", exact: true });
  await freeLink.click();
  await expect(page).toHaveURL(/free=true/);
  await expect(page.getByText("Feira Gratuita do Centro")).toBeVisible();
  await expect(page.getByText("Rock in Porto Alegre")).not.toBeVisible();

  // Same link, now active — FreeShortcut's own toggle behavior removes the filter.
  await page.getByRole("link", { name: "Grátis", exact: true }).click();
  await expect(page).not.toHaveURL(/free=true/);
  await expect(page.getByText("Rock in Porto Alegre").first()).toBeVisible();
});

test("browser back returns to the previous filter's results, not the most recent (stale) ones", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Categorias" }).getByRole("link", { name: "Cultural", exact: true }).click();
  await expect(page).toHaveURL(/category=cultural/);
  await expect(page.getByText("Virada Cultural Porto Alegre")).toBeVisible();

  await page.getByRole("link", { name: "Grátis", exact: true }).click();
  await expect(page).toHaveURL(/free=true/);
  await expect(page.getByText("Virada Cultural Porto Alegre")).not.toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/category=cultural/);
  await expect(page).not.toHaveURL(/free=true/);
  // The non-free event must reappear — if ResultsView kept the free-filtered (B) state, it
  // would still be missing here despite the URL correctly reflecting the prior (A) query.
  await expect(page.getByText("Virada Cultural Porto Alegre")).toBeVisible();
  await expect(page.getByText("Exposição Arte Gaúcha Contemporânea")).toBeVisible();
});

test("Carregar mais then applying a filter replaces the appended list, not extends it", async ({ page }) => {
  // Direct regression for the same ResultsView internal-state class of bug (section 25):
  // "Carregar mais" appends via client-side state; a subsequent filter navigation must fully
  // replace that state, not filter on top of the stale appended array.
  await page.goto("/");
  const eventList = page.getByRole("list", { name: "Lista de eventos" });
  const initialCount = await eventList.getByRole("listitem").count();
  await page.getByRole("button", { name: "Carregar mais" }).click();
  await expect
    .poll(() => eventList.getByRole("listitem").count(), { timeout: 10_000 })
    .toBeGreaterThan(initialCount);

  await page.getByRole("link", { name: "Grátis", exact: true }).click();
  await expect(page).toHaveURL(/free=true/);
  // Exactly the 5 free events in the golden Ticketmaster/Destino POA fixture set (Feira do
  // Livro de Porto Alegre, Exposição Arte Gaúcha Contemporânea, Festival de Cinema
  // Independente de Porto Alegre, Visita Guiada Usina do Gasômetro, Feira Gratuita do
  // Centro) — never the larger appended-then-filtered list a stale ResultsView would show.
  await expect(eventList.getByRole("listitem")).toHaveCount(5);
  await expect(page.getByText("Rock in Porto Alegre")).not.toBeVisible();
});
