import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { connectTestDatabase, truncateAllTables } from "../test-support.js";
import { recordAnalyticsEvent } from "./record-event.js";
import { computeProductSummary } from "./summary.js";

const connection = connectTestDatabase();

beforeEach(async () => {
  await truncateAllTables(connection);
});

afterAll(async () => {
  await connection.close();
});

describe("computeProductSummary", () => {
  it("returns zero counts and null ratios on an empty table", async () => {
    const summary = await computeProductSummary(connection.db);
    expect(summary.counts.page_view).toBe(0);
    expect(summary.eventViewPerPageView).toBeNull();
    expect(summary.intentPerEventView).toBeNull();
  });

  it("counts each event name independently", async () => {
    await recordAnalyticsEvent(connection.db, { eventName: "page_view", metadata: {} });
    await recordAnalyticsEvent(connection.db, { eventName: "page_view", metadata: {} });
    await recordAnalyticsEvent(connection.db, { eventName: "event_view", eventId: "evt-1", metadata: {} });
    await recordAnalyticsEvent(connection.db, { eventName: "search", metadata: {} });
    await recordAnalyticsEvent(connection.db, { eventName: "ticket_click", eventId: "evt-1", metadata: {} });

    const summary = await computeProductSummary(connection.db);
    expect(summary.counts.page_view).toBe(2);
    expect(summary.counts.event_view).toBe(1);
    expect(summary.counts.search).toBe(1);
    expect(summary.counts.ticket_click).toBe(1);
    expect(summary.counts.share).toBe(0);
  });

  it("computes eventViewPerPageView and intentPerEventView without claiming statistical significance", async () => {
    await recordAnalyticsEvent(connection.db, { eventName: "page_view", metadata: {} });
    await recordAnalyticsEvent(connection.db, { eventName: "page_view", metadata: {} });
    await recordAnalyticsEvent(connection.db, { eventName: "event_view", eventId: "evt-1", metadata: {} });
    await recordAnalyticsEvent(connection.db, { eventName: "ticket_click", eventId: "evt-1", metadata: {} });

    const summary = await computeProductSummary(connection.db);
    expect(summary.eventViewPerPageView).toBe(0.5);
    expect(summary.intentPerEventView).toBe(1);
  });
});
