import { readFile } from "node:fs/promises";
import type { CollectionContext, EventSourcePort, RawSourceEvent, SourceHealth } from "@cult/domain";
import { manualEventToRawSourceEvent, normalizeManualEvent, type ManualEventDto } from "@cult/connectors";
import { UI_DEMO_SOURCE_DEFINITION } from "@cult/config";
import { runIngestion, type IngestionSummary } from "./run-ingestion.js";

export type { IngestionSummary };

export const UI_DEMO_SOURCE_ID = UI_DEMO_SOURCE_DEFINITION.id;

interface ManualEventFeed {
  readonly events: readonly ManualEventDto[];
}

// test-data/ui-demo/events.json stores image_url as a root-relative path
// ("/demo-events/demo-music.svg") so the dataset file itself isn't coupled to any particular
// host/port. normalizeManualEvent's URL validation (shared, unmodified, with manual-beta and
// any future manual-shaped source) requires an absolute http(s) URL, so this is the one place
// that resolves it against the actual local Web origin before handing the DTO to that shared
// normalizer.
function resolveImageUrl(dto: ManualEventDto, webBaseUrl: string): ManualEventDto {
  if (!dto.imageUrl || !dto.imageUrl.startsWith("/")) return dto;
  return { ...dto, imageUrl: `${webBaseUrl}${dto.imageUrl}` };
}

export interface DemoDatasetAdapterConfig {
  readonly filePath: string;
  readonly webBaseUrl: string;
}

// M10.2 — reuses the manual connector's own RawSourceEvent shaping
// (manualEventToRawSourceEvent) and normalizer (normalizeManualEvent) under a distinct
// sourceId ("ui-demo", never "manual-beta") — see manual-file-adapter.ts's sourceId
// parameterization. This is deliberately its own small adapter rather than a
// ManualFileAdapterConfig.sourceId override at the call site: the image-URL resolution step
// above is specific to this dataset's local-asset convention, not something manual-beta or
// any real curator-authored file needs.
export function createDemoDatasetAdapter(config: DemoDatasetAdapterConfig): EventSourcePort {
  return {
    sourceId: UI_DEMO_SOURCE_ID,

    async *collect(_context: CollectionContext): AsyncIterable<RawSourceEvent> {
      const raw = await readFile(config.filePath, "utf8");
      const parsed = JSON.parse(raw) as ManualEventFeed;
      for (const dto of parsed.events) {
        yield manualEventToRawSourceEvent(resolveImageUrl(dto, config.webBaseUrl), UI_DEMO_SOURCE_ID);
      }
    },

    async healthCheck(): Promise<SourceHealth> {
      return { healthy: true, checkedAt: new Date() };
    },
  };
}

export interface RunDemoSeedOptions {
  readonly filePath: string;
  readonly webBaseUrl: string;
  readonly databaseUrl: string;
}

// Same composition root as every other connector (RawSourceEvent -> normalize ->
// CanonicalEvent via runIngestion, section 12) — nothing is inserted directly into the events
// table, so raw-store/provenance guarantees (ADR-0006) hold for demo events exactly as they
// do for real ones. Idempotent: canonicalEventRepository.save (inside runIngestion) upserts by
// id, and every demo event's id is deterministic (`ui-demo-<external id>`), so re-running
// `pnpm demo:seed` updates the same 10 rows rather than duplicating them.
export async function runDemoSeed(options: RunDemoSeedOptions): Promise<IngestionSummary> {
  const adapter = createDemoDatasetAdapter(options);
  return runIngestion<ManualEventDto>(adapter, normalizeManualEvent, UI_DEMO_SOURCE_DEFINITION, options.databaseUrl);
}
