// M7 Discovery API. All product-facing calendar-date semantics ("hoje", "amanhã", "fim de
// semana"...) resolve in America/Sao_Paulo — never the server's host timezone, never UTC
// (CLAUDE.md section 6 of the M7 spec). `now` is always the caller's instant, injected
// explicitly rather than read from Date.now() here, so this stays a pure function: the API
// layer supplies the real clock in production and a fixed instant in tests (section 40).
export type Period = "today" | "tomorrow" | "weekend" | "this_week" | "this_month";

export const PERIODS: readonly Period[] = ["today", "tomorrow", "weekend", "this_week", "this_month"];

export interface DateRange {
  readonly start: string; // YYYY-MM-DD, inclusive
  readonly end: string; // YYYY-MM-DD, inclusive
}

const TIME_ZONE = "America/Sao_Paulo";
const LOCAL_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function toLocalDate(instant: Date): string {
  return LOCAL_DATE_FORMATTER.format(instant);
}

// Pure calendar-date arithmetic: every date string is parsed as UTC midnight purely as a
// representation trick for correct day math (leap years, month/year rollover) — never as an
// instant with real-world meaning. Mirrors the same technique used in
// packages/deduplication/src/signals/temporal.ts.
function toUtcMidnight(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUtcMidnight(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  const d = toUtcMidnight(date);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcMidnight(d);
}

// 0 = Sunday, ..., 6 = Saturday (JS convention) — safe to read directly off the UTC-midnight
// representation above since day-of-week is a pure calendar property, independent of the
// UTC-vs-local distinction that matters for instants.
function dayOfWeek(date: string): number {
  return toUtcMidnight(date).getUTCDay();
}

function startOfWeek(date: string): string {
  // CULT's product week is Monday -> Sunday (section 11).
  const daysSinceMonday = (dayOfWeek(date) + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function endOfMonth(date: string): string {
  const d = toUtcMidnight(startOfMonth(date));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(d.getUTCDate() - 1);
  return fromUtcMidnight(d);
}

export function resolvePeriod(period: Period, now: Date): DateRange {
  const today = toLocalDate(now);

  switch (period) {
    case "today":
      return { start: today, end: today };
    case "tomorrow": {
      const tomorrow = addDays(today, 1);
      return { start: tomorrow, end: tomorrow };
    }
    case "weekend": {
      const monday = startOfWeek(today);
      const saturday = addDays(monday, 5);
      const sunday = addDays(monday, 6);
      return { start: saturday, end: sunday };
    }
    case "this_week": {
      const monday = startOfWeek(today);
      return { start: monday, end: addDays(monday, 6) };
    }
    case "this_month":
      return { start: startOfMonth(today), end: endOfMonth(today) };
    default: {
      const exhaustiveCheck: never = period;
      throw new Error(`Unhandled period: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
