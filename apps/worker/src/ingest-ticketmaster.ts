import type { EventSourcePort } from "@cult/domain";
import { normalizeTicketmasterEvent, type TicketmasterEvent } from "@cult/connectors";
import { TICKETMASTER_SOURCE_DEFINITION } from "@cult/config";
import { runIngestion, type IngestionSummary } from "./run-ingestion.js";

export type { IngestionSummary };

export async function runTicketmasterIngestion(
  adapter: EventSourcePort,
  databaseUrl: string,
): Promise<IngestionSummary> {
  return runIngestion<TicketmasterEvent>(
    adapter,
    normalizeTicketmasterEvent,
    TICKETMASTER_SOURCE_DEFINITION,
    databaseUrl,
  );
}
