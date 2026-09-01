import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDestinoPOAFixtureAdapter } from "@cult/connectors";
import { createCanonicalEventRepository } from "@cult/database";
import { connectTestDatabase, getTestDatabaseUrl, truncateAllTables } from "@cult/database/test-support";
import { runDestinoPOAIngestion } from "./ingest-destino-poa.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../test-data/golden-events/destino-poa/agenda-feed.json",
);

const connection = connectTestDatabase();

beforeEach(async () => {
  await truncateAllTables(connection);
});

afterAll(async () => {
  await connection.close();
});

describe("runDestinoPOAIngestion (fixture, PostgreSQL)", () => {
  it("collects, saves raw, normalizes and persists canonical events end-to-end", async () => {
    const adapter = createDestinoPOAFixtureAdapter({ fixturePath });
    const summary = await runDestinoPOAIngestion(adapter, getTestDatabaseUrl());

    expect(summary.source).toBe("destino-poa");
    expect(summary.discovered).toBe(10);
    expect(summary.rawSaved).toBe(10);
    // M4/ADR-0014: date-range and no-time-of-day events now normalize as date-only
    // occurrences instead of failing — only the malformed entry fails.
    expect(summary.normalized).toBe(9);
    expect(summary.canonicalSaved).toBe(9);
    expect(summary.failed).toBe(1);

    const repository = createCanonicalEventRepository(connection.db);
    const persisted = await repository.findById(
      "destino-poa-virada-cultural-porto-alegre-2026",
    );
    expect(persisted?.title).toBe("Virada Cultural Porto Alegre");
    expect(persisted?.sources[0]?.sourceId).toBe("destino-poa");
  });

  it("is idempotent: running it twice does not duplicate canonical events", async () => {
    const adapter = createDestinoPOAFixtureAdapter({ fixturePath });
    await runDestinoPOAIngestion(adapter, getTestDatabaseUrl());
    const second = await runDestinoPOAIngestion(
      createDestinoPOAFixtureAdapter({ fixturePath }),
      getTestDatabaseUrl(),
    );

    expect(second.canonicalSaved).toBe(9);
    const repository = createCanonicalEventRepository(connection.db);
    const persisted = await repository.findById(
      "destino-poa-virada-cultural-porto-alegre-2026",
    );
    expect(persisted).not.toBeNull();
  });
});
