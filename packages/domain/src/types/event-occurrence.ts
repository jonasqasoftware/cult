import { DomainValidationError } from "../errors.js";
import type { EventStatus } from "./event-status.js";

export interface EventOccurrence {
  readonly id: string;
  readonly eventId: string;
  readonly startsAt: Date;
  readonly endsAt?: Date;
  readonly timezone: "America/Sao_Paulo";
  readonly status: EventStatus;
}

export interface CreateEventOccurrenceInput {
  readonly id: string;
  readonly eventId: string;
  readonly startsAt: Date;
  readonly endsAt?: Date;
  readonly status: EventStatus;
}

export function createEventOccurrence(input: CreateEventOccurrenceInput): EventOccurrence {
  const { endsAt, startsAt } = input;

  if (endsAt !== undefined && endsAt.getTime() < startsAt.getTime()) {
    throw new DomainValidationError("EventOccurrence: endsAt cannot be before startsAt");
  }

  return {
    id: input.id,
    eventId: input.eventId,
    startsAt,
    ...(endsAt !== undefined ? { endsAt } : {}),
    timezone: "America/Sao_Paulo",
    status: input.status,
  };
}
