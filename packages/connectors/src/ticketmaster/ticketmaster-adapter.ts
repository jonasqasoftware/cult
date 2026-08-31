import { createHash, randomUUID } from "node:crypto";
import type { CollectionContext, EventSourcePort, RawSourceEvent, SourceHealth } from "@cult/domain";
import {
  createTicketmasterClient,
  type TicketmasterClientConfig,
} from "./ticketmaster-client.js";
import type { TicketmasterEvent } from "./ticketmaster-types.js";

export const TICKETMASTER_SOURCE_ID = "ticketmaster";

const RAW_EVENT_SCHEMA_VERSION = 1;
const DEFAULT_CITY = "Porto Alegre";
const DEFAULT_COUNTRY_CODE = "BR";
const DEFAULT_PAGE_SIZE = 20;
// Ticketmaster Discovery API documents a deep-paging ceiling: results past roughly the
// 1,000th record are not reliably accessible. Stop requesting further pages once we would
// cross it, rather than relying on undefined behavior from the provider.
const MAX_ACCESSIBLE_RECORDS = 1000;

export interface TicketmasterAdapterConfig extends TicketmasterClientConfig {
  readonly city?: string;
  readonly countryCode?: string;
  readonly pageSize?: number;
}

// Implements the provider-independent EventSourcePort from @cult/domain. Only ever produces
// RawSourceEvent — normalization into CanonicalEvent is a separate, later step
// (ticketmaster-normalizer.ts), never done here.
export function createTicketmasterAdapter(config: TicketmasterAdapterConfig): EventSourcePort {
  const client = createTicketmasterClient(config);
  const city = config.city ?? DEFAULT_CITY;
  const countryCode = config.countryCode ?? DEFAULT_COUNTRY_CODE;
  const pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;

  return {
    sourceId: TICKETMASTER_SOURCE_ID,

    async *collect(context: CollectionContext): AsyncIterable<RawSourceEvent> {
      const startDateTime = context.since ? context.since.toISOString() : undefined;
      let page = 0;

      for (;;) {
        if (page * pageSize >= MAX_ACCESSIBLE_RECORDS) {
          break;
        }

        const response = await client.searchEvents({
          countryCode,
          city,
          page,
          size: pageSize,
          ...(startDateTime ? { startDateTime } : {}),
        });

        const tmEvents = response._embedded?.events ?? [];
        for (const tmEvent of tmEvents) {
          yield ticketmasterEventToRawSourceEvent(tmEvent);
        }

        const totalPages = response.page?.totalPages ?? 1;
        page += 1;
        if (tmEvents.length === 0 || page >= totalPages) {
          break;
        }
      }
    },

    async healthCheck(): Promise<SourceHealth> {
      try {
        await client.searchEvents({ countryCode, city, size: 1 });
        return { healthy: true, checkedAt: new Date() };
      } catch (error) {
        return {
          healthy: false,
          checkedAt: new Date(),
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

// Exported for reuse by ticketmaster-fixture-adapter.ts, which maps the same
// Ticketmaster-shaped payload without making any HTTP call.
//
// tmEvent is untrusted external JSON — TypeScript's `id: string` is a compile-time promise
// only, not a runtime guarantee. When it's missing/blank we still preserve the raw payload
// (never discard on malformed input — ADR-0006) but externalId becomes undefined rather than
// a garbage value, so it falls into the "always insert, no dedup key" path instead of
// corrupting the (source_id, external_id) uniqueness space.
export function ticketmasterEventToRawSourceEvent(tmEvent: TicketmasterEvent): RawSourceEvent {
  const rawId = typeof tmEvent.id === "string" ? tmEvent.id.trim() : "";
  const externalId = rawId.length > 0 ? rawId : undefined;
  const sourceUrl =
    tmEvent.url ??
    (externalId
      ? `https://www.ticketmaster.com/event/${externalId}`
      : "https://app.ticketmaster.com/discovery/v2/events.json");

  return {
    id: randomUUID(),
    sourceId: TICKETMASTER_SOURCE_ID,
    ...(externalId ? { externalId } : {}),
    sourceUrl,
    payload: tmEvent,
    contentHash: hashPayload(tmEvent),
    fetchedAt: new Date(),
    schemaVersion: RAW_EVENT_SCHEMA_VERSION,
  };
}

// Sorts object keys recursively before stringifying, so contentHash depends only on the
// payload's actual content — never on incidental JSON key order — while still needing no
// canonical-JSON dependency.
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}
