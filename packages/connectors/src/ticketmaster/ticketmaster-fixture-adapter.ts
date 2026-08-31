import { readFile } from "node:fs/promises";
import type { CollectionContext, EventSourcePort, RawSourceEvent, SourceHealth } from "@cult/domain";
import { TICKETMASTER_SOURCE_ID, ticketmasterEventToRawSourceEvent } from "./ticketmaster-adapter.js";
import type { TicketmasterEventSearchResponse } from "./ticketmaster-types.js";

export interface TicketmasterFixtureAdapterConfig {
  readonly fixturePath: string;
}

// Reads a static, synthetic Ticketmaster-shaped JSON fixture instead of calling the live
// Discovery API — no network, no API key. Used by `pnpm ingest:ticketmaster:fixture` and by
// every automated test/CI run.
export function createTicketmasterFixtureAdapter(
  config: TicketmasterFixtureAdapterConfig,
): EventSourcePort {
  return {
    sourceId: TICKETMASTER_SOURCE_ID,

    async *collect(_context: CollectionContext): AsyncIterable<RawSourceEvent> {
      const raw = await readFile(config.fixturePath, "utf8");
      const parsed = JSON.parse(raw) as TicketmasterEventSearchResponse;
      const events = parsed._embedded?.events ?? [];
      for (const tmEvent of events) {
        yield ticketmasterEventToRawSourceEvent(tmEvent);
      }
    },

    async healthCheck(): Promise<SourceHealth> {
      return { healthy: true, checkedAt: new Date() };
    },
  };
}
