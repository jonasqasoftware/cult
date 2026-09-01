"use client";

import { useEffect } from "react";
import { track, type AnalyticsEventName, type TrackOptions } from "../lib/analytics/track";

// A page.tsx is a Server Component and can't call the browser-only track() itself — this is
// the one small client-side exception (same pattern as ServiceWorkerRegister), mounted once
// per page to fire its page_view/event_view. Renders nothing.
export function AnalyticsPageView({ event, ...options }: { event: AnalyticsEventName } & TrackOptions) {
  const metadataKey = options.metadata ? JSON.stringify(options.metadata) : "";
  useEffect(() => {
    track(event, options);
  }, [event, options.eventId, metadataKey]);

  return null;
}
