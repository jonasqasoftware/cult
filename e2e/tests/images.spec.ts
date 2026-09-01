import { createDatabaseConnection, type Database } from "@cult/database";
import { expect, test } from "@playwright/test";
import { deleteValidImageEvent, seedValidImageEvent, VALID_IMAGE_EVENT_SLUG, VALID_IMAGE_EVENT_TITLE, VALID_IMAGE_URL } from "./support/valid-image-event";

// M10.1 sections 7-17. Three image states are semantically distinct and tested separately:
//
// - valid  -> a real, loadable image (CULT's own synthetic asset, seeded here — the golden
//             Ticketmaster/Destino POA fixtures never carry a loadable image URL on purpose).
// - broken -> image_url set, but the request fails (reuses an existing golden fixture whose
//             image_url is `example.invalid` — see docs on why that domain is guaranteed to
//             never resolve, and why it's kept exactly as-is rather than "fixed").
// - missing -> image_url is null (reuses "Feira Gratuita do Centro", whose Ticketmaster
//             fixture payload never included an `images` array).
const DATABASE_URL = process.env["DATABASE_URL"] ?? "postgresql://cult:cult@localhost:5432/cult";

// `.serial` is not just for ordering here — it's what makes `beforeAll`/`afterAll` safe under
// `fullyParallel: true`. Playwright scopes file-level `beforeAll`/`afterAll` per *worker*, and
// a non-serial describe's tests can be split across multiple workers; an early-finishing
// worker's `afterAll` would then delete this event out from under another worker still
// mid-test (observed: an "opening the card..." test 404'd with "Evento não encontrado" when
// this was file-scoped and non-serial). `.serial` keeps every test here on one worker, so the
// single seed/cleanup pair brackets all of them correctly. See dedup.spec.ts for the same
// pattern, for the same underlying reason.
test.describe.serial("valid image", () => {
  let connection: ReturnType<typeof createDatabaseConnection>;

  test.beforeAll(async () => {
    connection = createDatabaseConnection({ connectionString: DATABASE_URL });
    await seedValidImageEvent(connection.db as Database);
  });

  test.afterAll(async () => {
    await deleteValidImageEvent(connection.db as Database);
    await connection.close();
  });

  test("renders a fully loaded image on the event card", async ({ page }) => {
    await page.goto(`/?q=${encodeURIComponent(VALID_IMAGE_EVENT_TITLE)}`);
    const card = page.getByRole("listitem").filter({ hasText: VALID_IMAGE_EVENT_TITLE });
    const image = card.getByRole("img", { name: VALID_IMAGE_EVENT_TITLE });

    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", VALID_IMAGE_URL);
    await expect(image).toHaveAttribute("alt", VALID_IMAGE_EVENT_TITLE);

    const loaded = await image.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0,
    );
    expect(loaded).toBe(true);

    // No fallback placeholder should be present alongside a successfully loaded image.
    await expect(card.getByTestId("event-image-placeholder")).toHaveCount(0);
  });

  test("the asset request itself succeeds (no external network dependency)", async ({ page }) => {
    const responsePromise = page.waitForResponse((response) => response.url().endsWith(VALID_IMAGE_URL));
    await page.goto(`/eventos/${VALID_IMAGE_EVENT_SLUG}`);
    const response = await responsePromise;
    expect(response.ok()).toBe(true);
  });

  test("renders a fully loaded image on the event detail page", async ({ page }) => {
    await page.goto(`/eventos/${VALID_IMAGE_EVENT_SLUG}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(VALID_IMAGE_EVENT_TITLE);

    const image = page.getByRole("img", { name: VALID_IMAGE_EVENT_TITLE });
    await expect(image).toBeVisible();
    await expect(image).toHaveAttribute("src", VALID_IMAGE_URL);

    const loaded = await image.evaluate(
      (img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0,
    );
    expect(loaded).toBe(true);
  });

  test("opening the card from the home page also shows the loaded image on detail", async ({ page }) => {
    await page.goto(`/?q=${encodeURIComponent(VALID_IMAGE_EVENT_TITLE)}`);
    await page.getByRole("listitem").filter({ hasText: VALID_IMAGE_EVENT_TITLE }).getByRole("link").click();
    await expect(page).toHaveURL(`/eventos/${VALID_IMAGE_EVENT_SLUG}`);

    const image = page.getByRole("img", { name: VALID_IMAGE_EVENT_TITLE });
    await expect(image).toBeVisible();
    // Polled, not a single evaluate: the image element exists as soon as the client-side
    // navigation renders it, but the fetch/decode itself still takes a (normally tiny) amount
    // of real time to finish — a single immediate check can catch it mid-flight under load.
    await expect
      .poll(() =>
        image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0 && img.naturalHeight > 0),
      )
      .toBe(true);
  });
});

test.describe("broken image (URL set, request fails)", () => {
  test("the CULT fallback placeholder is shown, never a native broken-image icon", async ({ page }) => {
    // "Virada Cultural Porto Alegre" (Destino POA golden fixture) carries
    // `https://example.invalid/dpoa/virada-cultural.webp` on purpose (section 7). `.invalid`
    // is a reserved TLD guaranteed to never resolve, but *how fast* a given network stack
    // gives up on it is not something this suite controls or should depend on (section 31) —
    // so the request is aborted deterministically via routing rather than relying on real
    // DNS/network failure timing.
    await page.route("https://example.invalid/**", (route) => route.abort());
    await page.goto("/?q=Virada+Cultural");
    const card = page.getByRole("listitem").filter({ hasText: "Virada Cultural Porto Alegre" });

    await expect(card.getByTestId("event-image-placeholder")).toBeVisible();
    // EventImage swaps the <img> element out entirely on error (see EventImage.tsx) — there
    // is no lingering broken <img> for the browser to render its native icon for.
    await expect(card.locator("img")).toHaveCount(0);
  });
});

test.describe("missing image (image_url is null)", () => {
  test("the same CULT fallback placeholder is shown, with no <img> element ever rendered", async ({ page }) => {
    // "Feira Gratuita do Centro" (Ticketmaster golden fixture) has no `images` array at all.
    // EventImage never renders an <img> tag when `src` is null (see EventImage.tsx) — so
    // asserting its absence is the causally accurate way to prove no image request was ever
    // attempted, without sniffing network traffic (which would also pick up unrelated
    // same-page requests like the site's own favicon/manifest and produce a flaky assertion).
    await page.goto("/?q=Feira+Gratuita");
    const card = page.getByRole("listitem").filter({ hasText: "Feira Gratuita do Centro" });

    await expect(card.getByTestId("event-image-placeholder")).toBeVisible();
    await expect(card.locator("img")).toHaveCount(0);
  });
});
