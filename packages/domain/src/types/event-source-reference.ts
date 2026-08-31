import { DomainValidationError } from "../errors.js";

// Links a CanonicalEvent to one of the sources that supports it (provenance).
export interface EventSourceReference {
  readonly sourceId: string;
  readonly externalId?: string;
  readonly url: string;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly lastVerifiedAt?: Date;
  readonly confidence: number;
}

export interface CreateEventSourceReferenceInput {
  readonly sourceId: string;
  readonly externalId?: string;
  readonly url: string;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly lastVerifiedAt?: Date;
  readonly confidence: number;
}

export function createEventSourceReference(
  input: CreateEventSourceReferenceInput,
): EventSourceReference {
  if (input.confidence < 0 || input.confidence > 1) {
    throw new DomainValidationError("EventSourceReference: confidence must be between 0 and 1");
  }

  return {
    sourceId: input.sourceId,
    ...(input.externalId !== undefined ? { externalId: input.externalId } : {}),
    url: input.url,
    firstSeenAt: input.firstSeenAt,
    lastSeenAt: input.lastSeenAt,
    ...(input.lastVerifiedAt !== undefined ? { lastVerifiedAt: input.lastVerifiedAt } : {}),
    confidence: input.confidence,
  };
}
