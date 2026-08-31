import type { RawSourceEvent } from "../types/raw-source-event.js";

export interface RawEventRepositoryPort {
  save(event: RawSourceEvent): Promise<void>;
  findBySourceAndExternalId(sourceId: string, externalId: string): Promise<RawSourceEvent | null>;
}
