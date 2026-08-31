import type { SourceDefinition } from "../types/source-definition.js";

export interface SourceRegistryPort {
  get(sourceId: string): SourceDefinition | undefined;
  list(): readonly SourceDefinition[];
}
