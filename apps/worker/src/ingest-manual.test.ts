import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createManualFileAdapter } from "@cult/connectors";
import { createCanonicalEventRepository } from "@cult/database";
import { connectTestDatabase, getTestDatabaseUrl, truncateAllTables } from "@cult/database/test-support";
import { runManualIngestion } from "./ingest-manual.js";

const filePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../test-data/golden-events/manual/events.json",
);

const connection = connectTestDatabase();

beforeEach(async () => {
  await truncateAllTables(connection);
});

afterAll(async () => {
  await connection.close();
});

describe("runManualIngestion (fixture, PostgreSQL)", () => {
  it("collects, saves raw, normalizes and persists canonical events end-to-end", async () => {
    const adapter = createManualFileAdapter({ filePath });
    const summary = await runManualIngestion(adapter, getTestDatabaseUrl());

    expect(summary.source).toBe("manual-beta");
    expect(summary.discovered).toBe(4);
    expect(summary.rawSaved).toBe(4);
    // The fourth fixture event has no venue — required for manual entries — so it fails.
    expect(summary.normalized).toBe(3);
    expect(summary.canonicalSaved).toBe(3);
    expect(summary.failed).toBe(1);

    const repository = createCanonicalEventRepository(connection.db);
    const persisted = await repository.findById("manual-beta-sarau-vila-flores-001");
    expect(persisted?.title).toBe("Sarau Cultural da Vila Flores");
    expect(persisted?.sources[0]?.sourceId).toBe("manual-beta");
    expect(persisted?.venue?.name).toBe("Centro Comunitário Vila Flores");
  });

  it("is idempotent: running it twice does not duplicate canonical events", async () => {
    const adapter = createManualFileAdapter({ filePath });
    await runManualIngestion(adapter, getTestDatabaseUrl());
    const second = await runManualIngestion(createManualFileAdapter({ filePath }), getTestDatabaseUrl());

    expect(second.canonicalSaved).toBe(3);
    const repository = createCanonicalEventRepository(connection.db);
    const persisted = await repository.findById("manual-beta-sarau-vila-flores-001");
    expect(persisted).not.toBeNull();
  });
});
