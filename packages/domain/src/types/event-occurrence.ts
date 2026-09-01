import { DomainValidationError } from "../errors.js";
import type { EventStatus } from "./event-status.js";

// ADR-0014: not every source gives a precise instant. A discriminated union lets each kind
// carry exactly the fields that are honest for it — a "date" occurrence has no startsAt to
// accidentally read, and a "timed" one has no startDate. Never convert one into the other by
// inventing a time of day (00:00, noon, etc.) — see the factories below.
export interface TimedEventOccurrence {
  readonly kind: "timed";
  readonly id: string;
  readonly eventId: string;
  readonly startsAt: Date;
  readonly endsAt?: Date;
  readonly timezone: "America/Sao_Paulo";
  readonly status: EventStatus;
}

// startDate/endDate are calendar dates, not instants — deliberately plain "YYYY-MM-DD"
// strings, never a JS Date. Both bounds are INCLUSIVE in CULT's domain semantics (a range
// "2026-08-29..2026-09-20" covers both endpoints). Converting that to an external format
// with different range semantics (e.g. iCalendar's exclusive DTEND) is an adapter/exporter
// concern, never the domain's.
export interface DateOnlyEventOccurrence {
  readonly kind: "date";
  readonly id: string;
  readonly eventId: string;
  readonly startDate: string;
  readonly endDate?: string;
  readonly timezone: "America/Sao_Paulo";
  readonly status: EventStatus;
}

export type EventOccurrence = TimedEventOccurrence | DateOnlyEventOccurrence;

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Strict YYYY-MM-DD only (rejects "2026-2-1") AND a real calendar date (rejects
// "2026-02-30"). String comparison of two such values is already chronological order, so
// range checks below never need to parse these into a Date.
function isValidCalendarDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  return (
    roundTrip.getUTCFullYear() === year &&
    roundTrip.getUTCMonth() === month - 1 &&
    roundTrip.getUTCDate() === day
  );
}

export interface CreateTimedEventOccurrenceInput {
  readonly id: string;
  readonly eventId: string;
  readonly startsAt: Date;
  readonly endsAt?: Date;
  readonly status: EventStatus;
}

export function createTimedEventOccurrence(
  input: CreateTimedEventOccurrenceInput,
): TimedEventOccurrence {
  const { endsAt, startsAt } = input;

  if (endsAt !== undefined && endsAt.getTime() < startsAt.getTime()) {
    throw new DomainValidationError("TimedEventOccurrence: endsAt cannot be before startsAt");
  }

  return {
    kind: "timed",
    id: input.id,
    eventId: input.eventId,
    startsAt,
    ...(endsAt !== undefined ? { endsAt } : {}),
    timezone: "America/Sao_Paulo",
    status: input.status,
  };
}

export interface CreateDateOnlyEventOccurrenceInput {
  readonly id: string;
  readonly eventId: string;
  readonly startDate: string;
  readonly endDate?: string;
  readonly status: EventStatus;
}

export function createDateOnlyEventOccurrence(
  input: CreateDateOnlyEventOccurrenceInput,
): DateOnlyEventOccurrence {
  const { startDate, endDate } = input;

  if (!isValidCalendarDate(startDate)) {
    throw new DomainValidationError(
      `DateOnlyEventOccurrence: startDate must be a valid YYYY-MM-DD date, got "${startDate}"`,
    );
  }

  if (endDate !== undefined) {
    if (!isValidCalendarDate(endDate)) {
      throw new DomainValidationError(
        `DateOnlyEventOccurrence: endDate must be a valid YYYY-MM-DD date, got "${endDate}"`,
      );
    }
    if (endDate < startDate) {
      throw new DomainValidationError("DateOnlyEventOccurrence: endDate cannot be before startDate");
    }
  }

  return {
    kind: "date",
    id: input.id,
    eventId: input.eventId,
    startDate,
    ...(endDate !== undefined ? { endDate } : {}),
    timezone: "America/Sao_Paulo",
    status: input.status,
  };
}
