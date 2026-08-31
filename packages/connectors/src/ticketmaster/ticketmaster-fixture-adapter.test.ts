import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createTicketmasterFixtureAdapter } from "./ticketmaster-fixture-adapter.js";
import { TICKETMASTER_SOURCE_ID } from "./ticketmaster-adapter.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../test-data/golden-events/ticketmaster/event-search-response.json",
);

describe("createTicketmasterFixtureAdapter", () => {
  it("yields RawSourceEvent entries from the fixture file without any network call", async () => {
    const adapter = createTicketmasterFixtureAdapter({ fixturePath });
    const collected = [];
    for await (const raw of adapter.collect({})) {
      collected.push(raw);
    }

    expect(adapter.sourceId).toBe(TICKETMASTER_SOURCE_ID);
    expect(collected.length).toBeGreaterThan(0);
    expect(collected.every((event) => event.sourceId === TICKETMASTER_SOURCE_ID)).toBe(true);
    expect(collected.map((event) => event.externalId)).toContain("TM-EVT-COMPLETE-0001");
  });

  it("always reports healthy (a local file is always available)", async () => {
    const adapter = createTicketmasterFixtureAdapter({ fixturePath });
    const health = await adapter.healthCheck();
    expect(health.healthy).toBe(true);
  });
});
