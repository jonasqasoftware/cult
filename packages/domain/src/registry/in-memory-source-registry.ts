import type { SourceDefinition } from "../types/source-definition.js";
import type { SourceRegistryPort } from "../ports/source-registry-port.js";

// Exists only to exercise the SourceRegistryPort contract in tests. No production
// source (Ticketmaster, Destino POA, Prefeitura POA) is registered here.
export function createInMemorySourceRegistry(
  definitions: readonly SourceDefinition[],
): SourceRegistryPort {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]));

  return {
    get(sourceId: string): SourceDefinition | undefined {
      return byId.get(sourceId);
    },
    list(): readonly SourceDefinition[] {
      return [...byId.values()];
    },
  };
}
