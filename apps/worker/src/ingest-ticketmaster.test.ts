import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createTicketmasterFixtureAdapter } from "@cult/connectors";
import { createCanonicalEventRepository } from "@cult/database";
import { connectTestDatabase, getTestDatabaseUrl, truncateAllTables } from "@cult/database/test-support";
import { runTicketmasterIngestion } from "./ingest-ticketmaster.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../test-data/golden-events/ticketmaster/event-search-response.json",
);

const connection = connectTestDatabase();

beforeEach(async () => {
  await truncateAllTables(connection);
});

afterAll(async () => {
  await connection.close();
});

describe("runTicketmasterIngestion (fixture, PostgreSQL)", () => {
  it("collects, saves raw, normalizes and persists canonical events end-to-end", async () => {
    const adapter = createTicketmasterFixtureAdapter({ fixturePath });
    const summary = await runTicketmasterIngestion(adapter, getTestDatabaseUrl());

    expect(summary.source).toBe("ticketmaster");
    expect(summary.discovered).toBe(6);
    expect(summary.rawSaved).toBe(6);
    // one fixture event has a deliberately unmappable status code
    expect(summary.normalized).toBe(5);
    expect(summary.canonicalSaved).toBe(5);
    expect(summary.failed).toBe(1);

    const repository = createCanonicalEventRepository(connection.db);
    const persisted = await repository.findById("ticketmaster-TM-EVT-COMPLETE-0001");
    expect(persisted?.title).toBe("Rock in Porto Alegre");
    expect(persisted?.sources[0]?.sourceId).toBe("ticketmaster");
  });

  it("is idempotent: running it twice does not duplicate canonical events", async () => {
    const adapter = createTicketmasterFixtureAdapter({ fixturePath });
    await runTicketmasterIngestion(adapter, getTestDatabaseUrl());
    const second = await runTicketmasterIngestion(
      createTicketmasterFixtureAdapter({ fixturePath }),
      getTestDatabaseUrl(),
    );

    expect(second.canonicalSaved).toBe(5);
    const repository = createCanonicalEventRepository(connection.db);
    const persisted = await repository.findById("ticketmaster-TM-EVT-COMPLETE-0001");
    expect(persisted).not.toBeNull();
  });
});
