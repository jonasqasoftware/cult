"use client";

import type { AnchorHTMLAttributes, ReactNode } from "react";
import { track, type AnalyticsEventName } from "../lib/analytics/track";

interface TrackedLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  readonly event: AnalyticsEventName;
  readonly eventId?: string;
  readonly children: ReactNode;
}

// Wraps a plain external <a> (ticket purchase, external map) with a fire-and-forget
// analytics call on click — never delays or blocks the navigation itself.
export function TrackedLink({ event, eventId, children, onClick, ...anchorProps }: TrackedLinkProps) {
  return (
    <a
      {...anchorProps}
      onClick={(clickEvent) => {
        track(event, eventId ? { eventId } : {});
        onClick?.(clickEvent);
      }}
    >
      {children}
    </a>
  );
}
