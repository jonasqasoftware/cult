import type { SourceDefinition } from "@cult/domain";
import { sources } from "./schema.js";
import type { Database } from "./client.js";

// Persists (a subset of) a SourceDefinition so raw_events/event_sources can carry a real
// foreign key to it. Full registry config (polling interval, connector name, terms URL, ...)
// stays in code (packages/config) for M2 — this table only needs what the FK relationship
// and minimal source-health reporting require.
export async function upsertSource(db: Database, source: SourceDefinition): Promise<void> {
  const values = {
    name: source.name,
    type: source.type,
    enabled: source.enabled,
    authorityScore: source.authorityScore,
    commercialUse: source.commercialUse,
    updatedAt: new Date(),
  };

  await db
    .insert(sources)
    .values({ id: source.id, ...values })
    .onConflictDoUpdate({ target: sources.id, set: values });
}
