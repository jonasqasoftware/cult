"use client";

import { useEffect } from "react";

// M8 (sections 51/52): baseline-only, for installability/future extensibility. No caching of
// any kind — event discovery/detail responses and map tiles must never be served stale, and
// this repo deliberately does not add Serwist/Workbox just to claim "offline support".
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is a nice-to-have, not a requirement — a failed registration (e.g. an
      // unsupported browser context) must never affect the page.
    });
  }, []);

  return null;
}
