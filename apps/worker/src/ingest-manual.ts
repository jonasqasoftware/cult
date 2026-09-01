import type { EventSourcePort } from "@cult/domain";
import { normalizeManualEvent, type ManualEventDto } from "@cult/connectors";
import { MANUAL_BETA_SOURCE_DEFINITION } from "@cult/config";
import { runIngestion, type IngestionSummary } from "./run-ingestion.js";

export type { IngestionSummary };

// M10 section 43 — the manual-beta fallback goes through the SAME composition root as every
// other connector (RawSourceEvent -> normalize -> CanonicalEvent via runIngestion). Nothing
// is inserted directly into the events table, so provenance/raw-store guarantees (ADR-0006)
// hold for manually-curated events exactly as they do for scraped/API ones.
export async function runManualIngestion(
  adapter: EventSourcePort,
  databaseUrl: string,
): Promise<IngestionSummary> {
  return runIngestion<ManualEventDto>(adapter, normalizeManualEvent, MANUAL_BETA_SOURCE_DEFINITION, databaseUrl);
}
