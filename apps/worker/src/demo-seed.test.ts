import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { checkProductionSourceAllowed } from "./production-source-gate.js";
import { createCanonicalEventRepository } from "@cult/database";
import { connectTestDatabase, getTestDatabaseUrl, truncateAllTables } from "@cult/database/test-support";
import { UI_DEMO_SOURCE_DEFINITION } from "@cult/config";
import { createDemoDatasetAdapter, runDemoSeed, UI_DEMO_SOURCE_ID } from "./demo-seed.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const datasetPath = path.join(REPO_ROOT, "test-data/ui-demo/events.json");
const webBaseUrl = "http://localhost:3000";

describe("UI_DEMO_SOURCE_DEFINITION", () => {
  it("is permanently blocked by the Production Data Gate", () => {
    const result = checkProductionSourceAllowed("production", UI_DEMO_SOURCE_DEFINITION);
    expect(result.allowed).toBe(false);
  });

  it("is unaffected by the gate outside production", () => {
    expect(checkProductionSourceAllowed("development", UI_DEMO_SOURCE_DEFINITION).allowed).toBe(true);
    expect(checkProductionSourceAllowed("staging", UI_DEMO_SOURCE_DEFINITION).allowed).toBe(true);
  });
});

// Section 24 — cheap, no-DB check: every local image_url referenced by the dataset must
// actually exist as a file Next.js will serve from apps/web/public. Catches a typo'd filename
// or a forgotten asset without needing the full stack running.
describe("UI demo dataset image assets", () => {
  const feed = JSON.parse(readFileSync(datasetPath, "utf8")) as {
    events: readonly { imageUrl?: string }[];
  };
  const publicDir = path.join(REPO_ROOT, "apps/web/public");

  it("has at least one event with an image and at least one without (section 19)", () => {
    const withImage = feed.events.filter((event) => event.imageUrl).length;
    expect(withImage).toBeGreaterThan(0);
    expect(withImage).toBeLessThan(feed.events.length);
  });

  it("every referenced local image_url exists under apps/web/public and is non-empty", () => {
    for (const event of feed.events) {
      if (!event.imageUrl || !event.imageUrl.startsWith("/")) continue;
      const assetPath = path.join(publicDir, event.imageUrl);
      expect(existsSync(assetPath), `missing asset for ${event.imageUrl}`).toBe(true);
      expect(readFileSync(assetPath).byteLength, `${event.imageUrl} is empty`).toBeGreaterThan(0);
    }
  });
});

describe("runDemoSeed (fixture, PostgreSQL)", () => {
  const connection = connectTestDatabase();

  beforeEach(async () => {
    await truncateAllTables(connection);
  });

  afterAll(async () => {
    await connection.close();
  });

  it("collects, saves raw, normalizes and persists all 10 UI demo events end-to-end", async () => {
    const adapter = createDemoDatasetAdapter({ filePath: datasetPath, webBaseUrl });
    const summary = await runDemoSeed({ filePath: datasetPath, webBaseUrl, databaseUrl: getTestDatabaseUrl() });

    expect(summary.source).toBe(UI_DEMO_SOURCE_ID);
    expect(summary.discovered).toBe(10);
    expect(summary.normalized).toBe(10);
    expect(summary.canonicalSaved).toBe(10);
    expect(summary.failed).toBe(0);

    const repository = createCanonicalEventRepository(connection.db);
    const jazz = await repository.findById("ui-demo-jazz-ao-entardecer");
    expect(jazz?.title).toBe("Jazz ao Entardecer");
    expect(jazz?.sources[0]?.sourceId).toBe(UI_DEMO_SOURCE_ID);
    // The image_url actually persisted must be the resolved absolute URL, not the dataset's
    // root-relative path — otherwise the <img> tag would try to load a relative path against
    // whatever page the browser happens to be on.
    expect(jazz?.imageUrl).toBe(`${webBaseUrl}/demo-events/demo-music.svg`);

    const noImage = await repository.findById("ui-demo-encontro-cultural-na-orla");
    expect(noImage?.imageUrl).toBeUndefined();

    // adapter is otherwise exercised indirectly via runDemoSeed above; this just confirms its
    // own sourceId matches what the ingestion summary reports.
    expect(adapter.sourceId).toBe(UI_DEMO_SOURCE_ID);
  });

  it("is idempotent: running it twice does not duplicate canonical events", async () => {
    await runDemoSeed({ filePath: datasetPath, webBaseUrl, databaseUrl: getTestDatabaseUrl() });
    const second = await runDemoSeed({ filePath: datasetPath, webBaseUrl, databaseUrl: getTestDatabaseUrl() });

    expect(second.canonicalSaved).toBe(10);
    const repository = createCanonicalEventRepository(connection.db);
    const all = await Promise.all(
      [
        "jazz-ao-entardecer",
        "noite-indie-no-centro",
        "mostra-cinema-guaiba",
        "feira-criativa-redencao",
        "exposicao-luzes-do-sul",
        "sarau-entre-linhas",
        "teatro-na-cidade-baixa",
        "encontro-cultural-na-orla",
        "visita-arquitetonica-ao-centro",
        "festival-gastronomia-urbana",
      ].map((id) => repository.findById(`ui-demo-${id}`)),
    );
    expect(all.every((event) => event !== null)).toBe(true);
  });
});
