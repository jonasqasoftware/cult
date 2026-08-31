import type { CanonicalEvent } from "../types/canonical-event.js";

export interface CanonicalEventRepositoryPort {
  save(event: CanonicalEvent): Promise<void>;
  findById(id: string): Promise<CanonicalEvent | null>;
  findBySlug(slug: string): Promise<CanonicalEvent | null>;
}
