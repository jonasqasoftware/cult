import { DomainValidationError } from "../errors.js";

export type SourceType = "api" | "crawler" | "feed" | "manual";

export type CommercialUse = "allowed" | "restricted" | "unknown";

export interface SourceDefinition {
  readonly id: string;
  readonly name: string;
  readonly type: SourceType;
  readonly enabled: boolean;
  readonly pollingIntervalMinutes: number;
  readonly authorityScore: number;
  readonly commercialUse: CommercialUse;
  readonly connector: string;
  readonly termsUrl?: string;
  readonly notes?: string;
}

export interface CreateSourceDefinitionInput {
  readonly id: string;
  readonly name: string;
  readonly type: SourceType;
  readonly enabled: boolean;
  readonly pollingIntervalMinutes: number;
  readonly authorityScore: number;
  readonly commercialUse: CommercialUse;
  readonly connector: string;
  readonly termsUrl?: string;
  readonly notes?: string;
}

export function createSourceDefinition(input: CreateSourceDefinitionInput): SourceDefinition {
  if (input.authorityScore < 0 || input.authorityScore > 1) {
    throw new DomainValidationError("SourceDefinition: authorityScore must be between 0 and 1");
  }
  if (input.pollingIntervalMinutes <= 0) {
    throw new DomainValidationError(
      "SourceDefinition: pollingIntervalMinutes must be greater than 0",
    );
  }

  return {
    id: input.id,
    name: input.name,
    type: input.type,
    enabled: input.enabled,
    pollingIntervalMinutes: input.pollingIntervalMinutes,
    authorityScore: input.authorityScore,
    commercialUse: input.commercialUse,
    connector: input.connector,
    ...(input.termsUrl !== undefined ? { termsUrl: input.termsUrl } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
}
