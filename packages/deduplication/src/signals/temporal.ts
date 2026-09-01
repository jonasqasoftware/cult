import type { EventOccurrence } from "@cult/domain";

const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

// ADR-0014: date-only means "the source did not report time precision" — never "this event
// runs 24 hours a day." This module never converts a date-only value into a fabricated
// instant; it only ever compares calendar-date ranges (both bounds inclusive, per ADR-0014)
// and, separately, real instants when both sides actually have one.
function toLocalDate(instant: Date): string {
  return LOCAL_DATE_FORMATTER.format(instant);
}

// A timed occurrence's local date is a degenerate 1-day range — this lets timed-vs-date,
// date-vs-date and date-range-vs-date-range all share one comparison function below.
function toDateRange(occurrence: EventOccurrence): { start: string; end: string } {
  if (occurrence.kind === "timed") {
    const date = toLocalDate(occurrence.startsAt);
    return { start: date, end: date };
  }
  return { start: occurrence.startDate, end: occurrence.endDate ?? occurrence.startDate };
}

function daysBetween(start: string, end: string): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / MS_PER_DAY);
}

export interface TemporalAssessment {
  readonly compatible: boolean;
  readonly similarity: number;
  readonly conflict?: "date_conflict" | "time_conflict";
}

// Two instants further apart than this are treated as unrelated for similarity purposes
// (still checked for same-day time_conflict separately).
const TIMED_SIMILARITY_DECAY_MINUTES = 240;
// Same calendar day, but far enough apart in time to plausibly be separate sessions.
const TIME_CONFLICT_THRESHOLD_MINUTES = 180;

export function assessTemporal(left: EventOccurrence, right: EventOccurrence): TemporalAssessment {
  if (left.kind === "timed" && right.kind === "timed") {
    return assessTimedPair(left.startsAt, right.startsAt);
  }
  return assessRangePair(toDateRange(left), toDateRange(right));
}

function assessTimedPair(left: Date, right: Date): TemporalAssessment {
  const sameLocalDate = toLocalDate(left) === toLocalDate(right);
  if (!sameLocalDate) {
    return { compatible: false, similarity: 0, conflict: "date_conflict" };
  }

  const diffMinutes = Math.abs(left.getTime() - right.getTime()) / 60_000;
  const similarity = Math.max(0, 1 - diffMinutes / TIMED_SIMILARITY_DECAY_MINUTES);

  if (diffMinutes > TIME_CONFLICT_THRESHOLD_MINUTES) {
    return { compatible: false, similarity, conflict: "time_conflict" };
  }
  return { compatible: true, similarity };
}

function assessRangePair(
  a: { start: string; end: string },
  b: { start: string; end: string },
): TemporalAssessment {
  const overlapStart = a.start > b.start ? a.start : b.start;
  const overlapEnd = a.end < b.end ? a.end : b.end;

  if (overlapStart > overlapEnd) {
    return { compatible: false, similarity: 0, conflict: "date_conflict" };
  }

  const lengthA = daysBetween(a.start, a.end) + 1;
  const lengthB = daysBetween(b.start, b.end) + 1;
  const overlapDays = daysBetween(overlapStart, overlapEnd) + 1;
  const similarity = (2 * overlapDays) / (lengthA + lengthB);

  return { compatible: true, similarity };
}
