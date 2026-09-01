import { randomUUID } from "node:crypto";
import type { AnalyticsEventName, AnalyticsMetadata } from "@cult/domain";
import { analyticsEvents } from "../schema.js";
import type { Database } from "../client.js";

export interface RecordAnalyticsEventInput {
  readonly eventName: AnalyticsEventName;
  readonly eventId?: string;
  readonly metadata: AnalyticsMetadata;
}

// Always called with an already-validated input (see @cult/domain's validateAnalyticsEvent)
// — this function itself does not re-validate the allowlist, it only persists.
export async function recordAnalyticsEvent(
  db: Database,
  input: RecordAnalyticsEventInput,
  now: Date = new Date(),
): Promise<void> {
  await db.insert(analyticsEvents).values({
    id: randomUUID(),
    eventName: input.eventName,
    eventId: input.eventId ?? null,
    metadataJson: input.metadata,
    createdAt: now,
  });
}
