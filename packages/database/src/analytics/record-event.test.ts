import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { connectTestDatabase, truncateAllTables } from "../test-support.js";
import { analyticsEvents } from "../schema.js";
import { recordAnalyticsEvent } from "./record-event.js";

const connection = connectTestDatabase();

beforeEach(async () => {
  await truncateAllTables(connection);
});

afterAll(async () => {
  await connection.close();
});

describe("recordAnalyticsEvent", () => {
  it("persists an event with metadata", async () => {
    await recordAnalyticsEvent(
      connection.db,
      { eventName: "filter_used", metadata: { period: "weekend" } },
      new Date("2026-01-01T00:00:00Z"),
    );

    const rows = await connection.db.select().from(analyticsEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.eventName).toBe("filter_used");
    expect(rows[0]?.metadataJson).toEqual({ period: "weekend" });
    expect(rows[0]?.eventId).toBeNull();
  });

  it("persists an eventId when provided", async () => {
    await recordAnalyticsEvent(
      connection.db,
      { eventName: "event_view", eventId: "evt-123", metadata: {} },
      new Date("2026-01-01T00:00:00Z"),
    );

    const rows = await connection.db.select().from(analyticsEvents);
    expect(rows[0]?.eventId).toBe("evt-123");
  });

  it("never throws even if called repeatedly in quick succession (best-effort write path)", async () => {
    await Promise.all([
      recordAnalyticsEvent(connection.db, { eventName: "page_view", metadata: {} }),
      recordAnalyticsEvent(connection.db, { eventName: "page_view", metadata: {} }),
      recordAnalyticsEvent(connection.db, { eventName: "page_view", metadata: {} }),
    ]);

    const rows = await connection.db.select().from(analyticsEvents);
    expect(rows).toHaveLength(3);
  });
});
