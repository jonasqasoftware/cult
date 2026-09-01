// CULT — minimal baseline service worker (M8 sections 51/52).
//
// Purpose: PWA installability / future extensibility only.
//
// Deliberately does NOT:
//   - cache event discovery or event detail responses (cultural listings go stale fast —
//     stale data is worse than no offline data at all);
//   - cache map tiles (OpenStreetMap policy also forbids offline/bulk tile caching — see
//     apps/web/README.md "Map");
//   - intercept fetch() at all. No cache, no offline mode, no Workbox/Serwist.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
