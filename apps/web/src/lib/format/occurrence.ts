import type { EventOccurrence } from "../api/types";

// Pure, generic date/time formatting for the public API's two occurrence shapes. Never
// constructs a JS Date from a "YYYY-MM-DD" date-only string (that would fabricate a UTC-
// midnight instant and risk rendering the wrong calendar day) — M7/M8: kind=date is a plain
// calendar date, not an instant, and never gets sub-day precision invented for it.
const MONTH_ABBREVIATIONS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
] as const;

const TIME_ZONE = "America/Sao_Paulo";
const LOCAL_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function localParts(iso: string): { day: number; month: number; hour: number; minute: number } {
  const parts = Object.fromEntries(LOCAL_PARTS_FORMATTER.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return {
    day: Number(parts["day"]),
    month: Number(parts["month"]),
    // Midnight renders as "24" under hour12:false in some engines — normalize to 0.
    hour: Number(parts["hour"]) % 24,
    minute: Number(parts["minute"]),
  };
}

export function formatTimedOccurrence(iso: string): string {
  const { day, month, hour, minute } = localParts(iso);
  const monthLabel = MONTH_ABBREVIATIONS[month - 1];
  const timeLabel = minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, "0")}`;
  return `${day} ${monthLabel} · ${timeLabel}`;
}

function parseDateOnly(dateStr: string): { day: number; month: number } {
  const [, month, day] = dateStr.split("-").map(Number);
  return { day: day as number, month: month as number };
}

export function formatDateOnly(dateStr: string): string {
  const { day, month } = parseDateOnly(dateStr);
  return `${day} ${MONTH_ABBREVIATIONS[month - 1]}`;
}

export function formatDateRange(start: string, end?: string): string {
  if (!end || end === start) return formatDateOnly(start);

  const startParts = parseDateOnly(start);
  const endParts = parseDateOnly(end);
  if (startParts.month === endParts.month) {
    return `${startParts.day}–${endParts.day} ${MONTH_ABBREVIATIONS[startParts.month - 1]}`;
  }
  return `${startParts.day} ${MONTH_ABBREVIATIONS[startParts.month - 1]} – ${formatDateOnly(end)}`;
}

export function formatOccurrence(occurrence: EventOccurrence): string {
  if (occurrence.kind === "timed") return formatTimedOccurrence(occurrence.starts_at);
  return formatDateRange(occurrence.start_date, occurrence.end_date ?? undefined);
}
