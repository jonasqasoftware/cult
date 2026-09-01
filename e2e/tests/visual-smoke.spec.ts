import { createDatabaseConnection, type Database } from "@cult/database";
import { expect, test, type Page } from "@playwright/test";
import { buildValidImageEventConfig, deleteValidImageEvent, seedValidImageEvent } from "./support/valid-image-event";

// M10.1 sections 18-20/29. Four required baselines only (never "snapshot everything" —
// section 20): home/desktop, home/mobile, a deterministic filtered state, and event detail
// with a valid image. Never the map (tiles are an external dependency — section 19/31) and
// never a screenshot of dynamic/timestamped content.
const DATABASE_URL = process.env["DATABASE_URL"] ?? "postgresql://cult:cult@localhost:5432/cult";

// This file's own unique event, distinct from images.spec.ts's — see
// support/valid-image-event.ts's header comment for why sharing one row across files is a race
// under `fullyParallel`.
const EVENT = buildValidImageEventConfig("visual-smoke");

// Section 19/31 — several golden fixture events carry `example.invalid` image URLs on
// purpose (section 7). `.invalid` is reserved to never resolve, but real-world DNS/network
// failure *timing* for it is not something this suite controls (observed directly: it can
// take much longer than any reasonable test timeout in some network environments) — so every
// such request is aborted deterministically, same as images.spec.ts's broken-image test, on
// every test in this file (not just the ones that intentionally exercise the fallback path).
test.beforeEach(async ({ page }) => {
  await page.route("https://example.invalid/**", (route) => route.abort());
});

// Section 19 — stability: reduced motion, animations/transitions forced off, and every
// currently-rendered <img> settled (loaded or errored-to-placeholder) before the screenshot,
// rather than an arbitrary sleep.
async function stabilize(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content: `*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; caret-color: transparent !important; }`,
  });
  await page.evaluate(() => document.fonts.ready);
  // Only images actually within the viewport matter here: `toHaveScreenshot` below captures
  // the viewport, not the full scrollable page, and most cards use `loading="lazy"` (by
  // design — apps/web/src/components/EventImage.tsx) so an off-screen image never starts
  // loading at all. Waiting on every <img> on the page (including ones below the fold) would
  // wait forever at a narrow/tall viewport where more cards fall outside it.
  await page.waitForFunction(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return Array.from(document.querySelectorAll("img")).every((img) => {
      const rect = img.getBoundingClientRect();
      const inViewport = rect.right > 0 && rect.left < vw && rect.bottom > 0 && rect.top < vh;
      return !inViewport || img.complete;
    });
  });
  // Double rAF: lets React's post-onError re-render (img -> placeholder swap) actually paint
  // before the screenshot, without depending on an arbitrary timeout.
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
}

test("Home / desktop (1280x720)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Lista de eventos" }).getByRole("listitem").first()).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot("home-desktop.png");
});

test("Home / mobile (390x844)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("list", { name: "Lista de eventos" }).getByRole("listitem").first()).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot("home-mobile.png");

  // Section 21 — no horizontal page overflow at the narrow viewport.
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

test("Filtered result state (category=cultural&free=true)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  // Deterministic 2-item intersection from the golden fixtures (both are categoryId
  // "cultural" and free:true) — see filter-composition.spec.ts for the same pair used
  // functionally.
  await page.goto("/?category=cultural&free=true");
  await expect(page.getByText("Exposição Arte Gaúcha Contemporânea")).toBeVisible();
  await stabilize(page);
  await expect(page).toHaveScreenshot("filtered-result.png");
});

// `.serial` + a describe-local beforeAll/afterAll (not file-scoped) — see images.spec.ts's
// "valid image" describe for why: a file-scoped beforeAll/afterAll under `fullyParallel: true`
// is scoped per *worker*, so a non-serial test elsewhere in this file finishing first could
// have its worker's afterAll delete this event while this test (possibly on another worker)
// is still using it.
test.describe.serial("event detail with a valid image", () => {
  let connection: ReturnType<typeof createDatabaseConnection>;

  test.beforeAll(async () => {
    connection = createDatabaseConnection({ connectionString: DATABASE_URL });
    await seedValidImageEvent(connection.db as Database, EVENT);
  });

  test.afterAll(async () => {
    await deleteValidImageEvent(connection.db as Database, EVENT);
    await connection.close();
  });

  test("Event detail with a valid image", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(`/eventos/${EVENT.slug}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await stabilize(page);
    await expect(page).toHaveScreenshot("event-detail-valid-image.png");
  });
});

test("Desktop grid shows multiple columns when there are enough events", async ({ page }) => {
  // Section 21 — a layout-behavior assertion, not a CSS implementation detail: at least two
  // cards share a row (different offsetTop) at desktop width.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  const cards = page.getByRole("list", { name: "Lista de eventos" }).getByRole("listitem");
  await expect(cards.first()).toBeVisible();
  const tops = await cards.evaluateAll((nodes) => nodes.slice(0, 4).map((node) => node.getBoundingClientRect().top));
  expect(new Set(tops).size).toBeLessThan(tops.length);
});
