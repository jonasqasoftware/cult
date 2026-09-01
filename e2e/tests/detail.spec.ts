import { expect, test } from "@playwright/test";

test("opening an event from the home page shows its detail page, and back returns home", async ({ page }) => {
  await page.goto("/");
  const eventList = page.getByRole("list", { name: "Lista de eventos" });
  const firstCard = eventList.getByRole("listitem").first();
  const title = (await firstCard.locator("h3").textContent())?.trim();
  expect(title).toBeTruthy();

  await firstCard.getByRole("link").click();
  await expect(page).toHaveURL(/\/eventos\//);
  await expect(page.getByRole("heading", { level: 1, name: title! })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: /descubra o que fazer/i })).toBeVisible();
});

test("event detail shows a ticket CTA and source link when the API provides them", async ({ page }) => {
  await page.goto("/eventos/rock-in-porto-alegre-54879fed");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rock in Porto Alegre");
  await expect(page.getByRole("link", { name: "Ver ingresso" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fonte" })).toBeVisible();
});

test("event detail never shows internal/provisional fields", async ({ page }) => {
  await page.goto("/eventos/rock-in-porto-alegre-54879fed");
  const bodyText = await page.locator("body").innerText();
  expect(bodyText).not.toContain("quality_score");
  expect(bodyText).not.toContain("ranking_score");
  expect(bodyText).not.toMatch(/confidence/i);
});

test("share falls back to copying the link and shows a confirmation", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/eventos/rock-in-porto-alegre-54879fed");
  await page.getByRole("button", { name: "Compartilhar" }).click();
  // The aria-live announcement is the canonical, unambiguous signal that the confirmation
  // fired (a visible <span> with the same text also exists for sighted users).
  await expect(page.getByRole("status")).toHaveText("Link copiado");
});

test("a nonexistent event slug shows a not-found page with a way back home", async ({ page }) => {
  await page.goto("/eventos/does-not-exist-at-all");
  await expect(page.getByRole("heading", { name: /não encontrado/i })).toBeVisible();
  await page.getByRole("link", { name: "Voltar para a página inicial" }).click();
  await expect(page).toHaveURL("/");
});
