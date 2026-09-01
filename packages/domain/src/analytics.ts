// M10 sections 25-28 — first-party, minimal, privacy-safe product analytics. This module is
// the ONE place the event-name/metadata allowlist is defined, so the Web BFF
// (apps/web/src/app/api/analytics/route.ts) and the private API endpoint
// (apps/api's POST /v1/analytics) validate against the exact same rules rather than two
// independently-maintained copies drifting apart.
export const ANALYTICS_EVENT_NAMES = [
  "page_view",
  "event_view",
  "search",
  "filter_used",
  "nearby_used",
  "map_opened",
  "share",
  "ticket_click",
  "maps_click",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];

// M10 section 27 — deliberately small and product-justified. Never latitude/longitude (even
// approximate), never anything that could re-identify a specific request/device.
export const ANALYTICS_METADATA_ALLOWLIST = ["period", "category", "free"] as const;

export type AnalyticsMetadataKey = (typeof ANALYTICS_METADATA_ALLOWLIST)[number];
export type AnalyticsMetadataValue = string | number | boolean;
export type AnalyticsMetadata = Partial<Record<AnalyticsMetadataKey, AnalyticsMetadataValue>>;

export interface AnalyticsEventInput {
  readonly eventName: string;
  readonly eventId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type AnalyticsValidationResult =
  | {
      readonly valid: true;
      readonly eventName: AnalyticsEventName;
      readonly eventId?: string;
      readonly metadata: AnalyticsMetadata;
    }
  | { readonly valid: false; readonly reason: string };

const MAX_METADATA_STRING_LENGTH = 64;
const MAX_EVENT_ID_LENGTH = 200;

// Pure — no I/O, no framework types. Rejects (never silently drops) anything outside the
// allowlist: a caller sending an unexpected field is a bug worth surfacing, not data worth
// guessing how to sanitize.
export function validateAnalyticsEvent(input: AnalyticsEventInput): AnalyticsValidationResult {
  if (!(ANALYTICS_EVENT_NAMES as readonly string[]).includes(input.eventName)) {
    return { valid: false, reason: `Unknown analytics event_name: "${input.eventName}"` };
  }
  const eventName = input.eventName as AnalyticsEventName;

  if (input.eventId !== undefined) {
    if (typeof input.eventId !== "string" || input.eventId.length === 0 || input.eventId.length > MAX_EVENT_ID_LENGTH) {
      return { valid: false, reason: `event_id must be a non-empty string of at most ${MAX_EVENT_ID_LENGTH} characters` };
    }
  }

  const metadata: AnalyticsMetadata = {};
  for (const [key, value] of Object.entries(input.metadata ?? {})) {
    if (!(ANALYTICS_METADATA_ALLOWLIST as readonly string[]).includes(key)) {
      return { valid: false, reason: `metadata key "${key}" is not allowlisted` };
    }
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") {
      return { valid: false, reason: `metadata.${key} must be a string, number, or boolean` };
    }
    if (typeof value === "string" && value.length > MAX_METADATA_STRING_LENGTH) {
      return { valid: false, reason: `metadata.${key} exceeds ${MAX_METADATA_STRING_LENGTH} characters` };
    }
    metadata[key as AnalyticsMetadataKey] = value;
  }

  return {
    valid: true,
    eventName,
    ...(input.eventId !== undefined ? { eventId: input.eventId } : {}),
    metadata,
  };
}
