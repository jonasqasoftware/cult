import { sql } from "drizzle-orm";
import { ANALYTICS_EVENT_NAMES, type AnalyticsEventName } from "@cult/domain";
import type { Database } from "../client.js";

export interface ProductSummary {
  readonly counts: Record<AnalyticsEventName, number>;
  // M10 section 30 — small ratios useful for a beta with a handful of users, never presented
  // as statistically significant. null (not 0) when the denominator is zero, so a caller
  // can't misread "no data yet" as "zero conversion."
  readonly eventViewPerPageView: number | null;
  readonly intentPerEventView: number | null;
}

interface CountRow extends Record<string, unknown> {
  readonly event_name: string;
  readonly count: string;
}

export async function computeProductSummary(db: Database): Promise<ProductSummary> {
  const result = await db.execute<CountRow>(
    sql`SELECT event_name, COUNT(*)::text AS count FROM analytics_events GROUP BY event_name`,
  );

  const counts = Object.fromEntries(ANALYTICS_EVENT_NAMES.map((name) => [name, 0])) as Record<
    AnalyticsEventName,
    number
  >;
  for (const row of result.rows) {
    if ((ANALYTICS_EVENT_NAMES as readonly string[]).includes(row.event_name)) {
      counts[row.event_name as AnalyticsEventName] = Number(row.count);
    }
  }

  const eventViewPerPageView = counts.page_view > 0 ? counts.event_view / counts.page_view : null;
  const intentEvents = counts.ticket_click + counts.maps_click;
  const intentPerEventView = counts.event_view > 0 ? intentEvents / counts.event_view : null;

  return { counts, eventViewPerPageView, intentPerEventView };
}
