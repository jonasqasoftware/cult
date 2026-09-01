import type { EventSourcePort } from "@cult/domain";
import { normalizeDestinoPOAEvent, type DestinoPOAEventDto } from "@cult/connectors";
import { DESTINO_POA_SOURCE_DEFINITION } from "@cult/config";
import { runIngestion, type IngestionSummary } from "./run-ingestion.js";

export type { IngestionSummary };

// Fixture-only in M3 — the only EventSourcePort implementation for Destino POA is
// createDestinoPOAFixtureAdapter. There is no live-persisting adapter to pass here yet
// (see docs/sources/destino-poa.md); this function itself is provider-agnostic and would
// work unmodified with a future live adapter once persistence is legally cleared.
export async function runDestinoPOAIngestion(
  adapter: EventSourcePort,
  databaseUrl: string,
): Promise<IngestionSummary> {
  return runIngestion<DestinoPOAEventDto>(
    adapter,
    normalizeDestinoPOAEvent,
    DESTINO_POA_SOURCE_DEFINITION,
    databaseUrl,
  );
}
