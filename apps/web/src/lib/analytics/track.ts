// Deliberately NOT importing @cult/domain's AnalyticsEventName here — same discipline as
// lib/api/types.ts ("Mirrors openapi/cult-api.yaml exactly ... Deliberately NOT the
// internal @cult/domain..."): this is the browser-facing boundary, so it mirrors the public
// contract as a small local literal rather than pulling a workspace package into the
// client bundle.
export type AnalyticsEventName =
  | "page_view"
  | "event_view"
  | "search"
  | "filter_used"
  | "nearby_used"
  | "map_opened"
  | "share"
  | "ticket_click"
  | "maps_click";

export interface TrackOptions {
  readonly eventId?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean>>;
}

// M10 section 29 — analytics is best-effort and must NEVER block or fail a product action.
// Fire-and-forget: never awaited by a caller, every failure mode (network error, no
// sendBeacon/fetch support, the API being down) is swallowed here rather than surfaced.
export function track(eventName: AnalyticsEventName, options: TrackOptions = {}): void {
  if (typeof window === "undefined") return;

  const payload = JSON.stringify({
    event_name: eventName,
    ...(options.eventId ? { event_id: options.eventId } : {}),
    ...(options.metadata ? { metadata: options.metadata } : {}),
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/analytics", blob);
      return;
    }
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // Swallowed on purpose — see the function-level comment.
    });
  } catch {
    // Swallowed on purpose — see the function-level comment.
  }
}
