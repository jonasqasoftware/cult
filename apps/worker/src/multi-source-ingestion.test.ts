import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createDestinoPOAFixtureAdapter, createTicketmasterFixtureAdapter } from "@cult/connectors";
import { discoverEvents } from "@cult/database";
import { connectTestDatabase, getTestDatabaseUrl, truncateAllTables } from "@cult/database/test-support";
import { runDestinoPOAIngestion } from "./ingest-destino-poa.js";
import { runTicketmasterIngestion } from "./ingest-ticketmaster.js";

const ticketmasterFixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../test-data/golden-events/ticketmaster/event-search-response.json",
);
const destinoPOAFixturePath = path.join(
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

describe("multi-source coexistence", () => {
  it("persists Ticketmaster and Destino POA events side by side without deduplication", async () => {
    const ticketmasterSummary = await runTicketmasterIngestion(
      createTicketmasterFixtureAdapter({ fixturePath: ticketmasterFixturePath }),
      getTestDatabaseUrl(),
    );
    const destinoPOASummary = await runDestinoPOAIngestion(
      createDestinoPOAFixtureAdapter({ fixturePath: destinoPOAFixturePath }),
      getTestDatabaseUrl(),
    );

    expect(ticketmasterSummary.canonicalSaved).toBe(5);
    expect(destinoPOASummary.canonicalSaved).toBe(9);

    // M7: discoverEvents defaults to status=scheduled (section 18) — one of the five
    // Ticketmaster fixtures is "cancelled", so 13 of the 14 saved events are discoverable by
    // default rather than all 14. Fetching with an explicit status confirms it still exists.
    const { items } = await discoverEvents(connection.db, { limit: 100 });
    const events = items.map((item) => item.event);
    expect(events).toHaveLength(13);

    const cancelled = await discoverEvents(connection.db, { limit: 100, status: "cancelled" });
    expect(cancelled.items).toHaveLength(1);
    expect(cancelled.items[0]?.event.sources[0]?.sourceId).toBe("ticketmaster");

    const bySource = new Map<string, number>();
    for (const event of events) {
      for (const source of event.sources) {
        bySource.set(source.sourceId, (bySource.get(source.sourceId) ?? 0) + 1);
      }
    }
    expect(bySource.get("ticketmaster")).toBe(4);
    expect(bySource.get("destino-poa")).toBe(9);

    // Two distinct CanonicalEvent rows for the intentionally same-titled events — no
    // cross-source dedup/merge happens in M3 (deferred to a future milestone).
    const sameTitle = events.filter((event) => event.title === "Rock in Porto Alegre");
    expect(sameTitle).toHaveLength(2);
    expect(sameTitle[0]?.id).not.toBe(sameTitle[1]?.id);
    expect(new Set(sameTitle.map((event) => event.sources[0]?.sourceId))).toEqual(
      new Set(["ticketmaster", "destino-poa"]),
    );

    // M4/ADR-0014: both occurrence kinds coexist across sources in the same table.
    const kinds = new Set(events.flatMap((event) => event.occurrences.map((occurrence) => occurrence.kind)));
    expect(kinds).toEqual(new Set(["timed", "date"]));
  });
});
