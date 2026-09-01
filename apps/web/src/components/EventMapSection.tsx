"use client";

import dynamic from "next/dynamic";
import type { CultEvent } from "../lib/api/types";

// next/dynamic's `ssr: false` is only usable from a Client Component — this thin wrapper is
// the reason it exists, so the (Server Component) event detail page can still lazy-load the
// map without shipping MapLibre in its own initial bundle (section 44/58).
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), { ssr: false });

export function EventMapSection({ event }: { event: CultEvent }) {
  return <MapView events={[event]} />;
}
