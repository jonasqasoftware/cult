import type { RawSourceEvent } from "../types/raw-source-event.js";

export interface CollectionContext {
  readonly since?: Date;
}

export interface SourceHealth {
  readonly healthy: boolean;
  readonly checkedAt: Date;
  readonly message?: string;
}

// Implemented by connectors (Ticketmaster, Destino POA, Prefeitura POA, ...).
// No implementation lives in the domain — this is only the contract.
export interface EventSourcePort {
  readonly sourceId: string;
  collect(context: CollectionContext): AsyncIterable<RawSourceEvent>;
  healthCheck(): Promise<SourceHealth>;
}
