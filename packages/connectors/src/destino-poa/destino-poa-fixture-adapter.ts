import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CollectionContext, EventSourcePort, RawSourceEvent, SourceHealth } from "@cult/domain";
import { hashPayload } from "@cult/canonical-events";
import type { DestinoPOAAgendaFeed, DestinoPOAEventDto } from "./destino-poa-types.js";

export const DESTINO_POA_SOURCE_ID = "destino-poa";

const RAW_EVENT_SCHEMA_VERSION = 1;

export interface DestinoPOAFixtureAdapterConfig {
  readonly fixturePath: string;
}

// The ONLY EventSourcePort implementation for Destino POA in M3. Reads a static, synthetic
// JSON fixture — no network, no live persistence. A separate, non-EventSourcePort module
// (destino-poa-inspector.ts) exists for bounded, read-only live discovery; it is
// structurally incapable of feeding this pipeline, which is the point (see M3 report,
// section on live persistence being blocked).
export function createDestinoPOAFixtureAdapter(
  config: DestinoPOAFixtureAdapterConfig,
): EventSourcePort {
  return {
    sourceId: DESTINO_POA_SOURCE_ID,

    async *collect(_context: CollectionContext): AsyncIterable<RawSourceEvent> {
      const raw = await readFile(config.fixturePath, "utf8");
      const parsed = JSON.parse(raw) as DestinoPOAAgendaFeed;
      for (const dto of parsed.events) {
        yield destinoPOAEventToRawSourceEvent(dto);
      }
    },

    async healthCheck(): Promise<SourceHealth> {
      return { healthy: true, checkedAt: new Date() };
    },
  };
}

// dto.id/url are untrusted (ultimately HTML-derived) — same discipline as the Ticketmaster
// connector: a missing/blank identifier degrades to "no externalId" rather than a garbage
// value, so it falls into the "always insert, no dedup key" repository path.
export function destinoPOAEventToRawSourceEvent(dto: DestinoPOAEventDto): RawSourceEvent {
  const externalId = extractStableId(dto);
  const sourceUrl = dto.url ?? "https://destinopoa.com.br/agenda/";

  return {
    id: randomUUID(),
    sourceId: DESTINO_POA_SOURCE_ID,
    ...(externalId ? { externalId } : {}),
    sourceUrl,
    payload: dto,
    contentHash: hashPayload(dto),
    fetchedAt: new Date(),
    schemaVersion: RAW_EVENT_SCHEMA_VERSION,
  };
}

function extractStableId(dto: DestinoPOAEventDto): string | undefined {
  const id = dto.id?.trim();
  if (id) return id;
  const url = dto.url?.trim();
  if (!url) return undefined;
  const match = /\/evento\/([^/]+)\/?$/.exec(url);
  return match?.[1];
}
