import { PERIODS, resolvePeriod, type DateRange, type Period } from "./period.js";

export type DateRangeFilterError = "invalid-period" | "invalid-date" | "invalid-filter-combination";

export type DateRangeFilterResult =
  | { readonly ok: true; readonly range: DateRange | undefined }
  | { readonly ok: false; readonly error: DateRangeFilterError };

export interface DateRangeFilterInput {
  readonly period?: string;
  readonly start?: string;
  readonly end?: string;
}

const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Rejects malformed strings AND impossible calendar dates (e.g. 2026-02-30) — a naive regex
// match alone would accept the latter.
function isValidCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
}

function isPeriod(value: string): value is Period {
  return (PERIODS as readonly string[]).includes(value);
}

// Section 29: period and start/end are never combined silently — one or the other, never
// both, and never a silent precedence rule. Section 30's lat/lng "exige par completo" pattern
// is mirrored here for start/end: a one-sided custom range is rejected rather than guessed at
// (open-ended forward/backward ranges are not part of this milestone's scope).
export function resolveDateRangeFilter(input: DateRangeFilterInput, now: Date): DateRangeFilterResult {
  const hasPeriod = input.period !== undefined;
  const hasStart = input.start !== undefined;
  const hasEnd = input.end !== undefined;

  if (hasPeriod && (hasStart || hasEnd)) {
    return { ok: false, error: "invalid-filter-combination" };
  }

  if (hasPeriod) {
    if (!isPeriod(input.period!)) {
      return { ok: false, error: "invalid-period" };
    }
    return { ok: true, range: resolvePeriod(input.period!, now) };
  }

  if (hasStart !== hasEnd) {
    return { ok: false, error: "invalid-filter-combination" };
  }

  if (!hasStart) {
    return { ok: true, range: undefined };
  }

  if (!isValidCalendarDate(input.start!) || !isValidCalendarDate(input.end!)) {
    return { ok: false, error: "invalid-date" };
  }
  if (input.start! > input.end!) {
    return { ok: false, error: "invalid-date" };
  }

  return { ok: true, range: { start: input.start!, end: input.end! } };
}
