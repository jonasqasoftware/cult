import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { CollectionContext, EventSourcePort, RawSourceEvent, SourceHealth } from "@cult/domain";
import { hashPayload } from "@cult/canonical-events";
import type { ManualEventDto, ManualEventFeed } from "./manual-types.js";

export const MANUAL_SOURCE_ID = "manual-beta";

const RAW_EVENT_SCHEMA_VERSION = 1;

export interface ManualFileAdapterConfig {
  readonly filePath: string;
}

// The M10 fallback source (section 42/43) — reads a curator-authored JSON file from an
// arbitrary path (unlike the fixture adapters, which always read one fixed fixture file),
// so the same pipeline (RawSourceEvent -> normalize -> CanonicalEvent) can ingest whatever
// batch of manually-authorized events an operator hands it via `pnpm ingest:manual <file>`.
export function createManualFileAdapter(config: ManualFileAdapterConfig): EventSourcePort {
  return {
    sourceId: MANUAL_SOURCE_ID,

    async *collect(_context: CollectionContext): AsyncIterable<RawSourceEvent> {
      const raw = await readFile(config.filePath, "utf8");
      const parsed = JSON.parse(raw) as ManualEventFeed;
      for (const dto of parsed.events) {
        yield manualEventToRawSourceEvent(dto);
      }
    },

    async healthCheck(): Promise<SourceHealth> {
      return { healthy: true, checkedAt: new Date() };
    },
  };
}

export function manualEventToRawSourceEvent(dto: ManualEventDto): RawSourceEvent {
  const externalId = dto.id?.trim();
  const sourceUrl = dto.sourceUrl ?? "";

  return {
    id: randomUUID(),
    sourceId: MANUAL_SOURCE_ID,
    ...(externalId ? { externalId } : {}),
    sourceUrl,
    payload: dto,
    contentHash: hashPayload(dto),
    fetchedAt: new Date(),
    schemaVersion: RAW_EVENT_SCHEMA_VERSION,
  };
}
