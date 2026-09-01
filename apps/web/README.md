# @cult/web

The CULT discovery web/PWA — Next.js 16 (App Router), React 19, TypeScript strict.

## Env vars

| Variable | Where it's read | Purpose |
| --- | --- | --- |
| `CULT_API_BASE_URL` | Server only | Private Fastify API base URL. **Never** `NEXT_PUBLIC_*` — the API stays unreachable from the browser. Defaults to `http://localhost:3001`. |
| `NEXT_PUBLIC_SITE_URL` | Public | Used for canonical URLs, OpenGraph, and metadata. Defaults to `http://localhost:3000`. |
| `NEXT_PUBLIC_MAP_TILE_URL` | Public | Substitutable map tile source (see "Map" below). Unset = OpenStreetMap's standard tile server. |
| `NEXT_PUBLIC_MAP_ATTRIBUTION` | Public | Attribution HTML shown by MapLibre's attribution control. Unset = the standard OSM attribution string. |
| `WEB_PORT` | Dev/start scripts | Local port, default 3000. |

See the repo root `.env.example`.

## Dev commands

```bash
pnpm dev:web       # next dev
pnpm --filter @cult/web run build
pnpm --filter @cult/web run start
pnpm --filter @cult/web run typecheck
```

Unit tests run through the repo's root `pnpm test` (Vitest picks up `apps/web/src/**/*.test.ts`
automatically). E2E: see "E2E" below.

## Architecture: server/client boundary

Server Components by default (App Router). Client Components exist only where the browser
API genuinely requires it:

- `NearbyButton` — `navigator.geolocation`
- `ShareButton` — `navigator.share` / `navigator.clipboard`
- `EventImage` — `onError` fallback for a broken image
- `ResultsView` — local state for "Carregar mais" (load more) and the Lista/Mapa toggle
- `MapView` (+ its two lazy-loading wrappers, `ResultsView`'s inline `next/dynamic` and
  `EventMapSection`) — MapLibre GL needs a real DOM node and browser APIs
- `ServiceWorkerRegister` — `navigator.serviceWorker`

The search form and every filter shortcut (period, free, category) are plain `<a>`/`<form
method="get">` elements — they work with zero client JS, reflect state in the URL (shareable
links, back/forward, SSR, basic SEO — M8 section 12), and only the two things that
*need* a real API call after the initial load (load more, the map) ship any client JS at all.

## API boundary

`src/lib/api/` is the only place that talks to the Fastify API. Its types (`src/lib/api/types.ts`)
mirror `openapi/cult-api.yaml`'s public, snake_case contract — deliberately not the internal
`@cult/domain` `CanonicalEvent` type, which is a different boundary. `src/lib/api/client.ts`
throws a typed `CultApiError` (status + parsed Problem Details when available) rather than
letting a raw fetch/parse error propagate; page error handling never shows the underlying
message to the user (SQL/hostname/stack-free, matching the API's own M7.1 error discipline).

`app/api/discovery/route.ts` is a small BFF (not an open proxy): it accepts only the known
public discovery filters (via the same whitelist-parsing `searchParamsToFilters` the page
itself uses), calls `CULT_API_BASE_URL` server-side, and is used only by `ResultsView`'s
"Carregar mais" to fetch a further page client-side without exposing the API base URL to the
browser.

## Map

MapLibre GL JS, pinned to an exact version (`maplibre-gl@6.6.0` — no `^` range, per the ESM-only
concerns noted in the milestone spec). Verified against both `next dev` and `next build` +
`next start` (Turbopack). Lazy-loaded via `next/dynamic({ ssr: false })` — it never enters the
initial bundle for a session that never opens the map.

Tile source is substitutable via `NEXT_PUBLIC_MAP_TILE_URL` (`src/lib/map/tile-config.ts`),
defaulting to OpenStreetMap's standard tile server. If you keep that default:

- HTTPS only (already the default URL).
- Attribution is always visible — MapLibre's built-in attribution control renders whatever
  `NEXT_PUBLIC_MAP_ATTRIBUTION` (or the OSM default) says.
- No prefetching, no bulk/offline tile download, no extra caching layer of our own — MapLibre
  requests only the tiles for the current viewport, and the service worker (below) never
  intercepts tile requests.

**Known limitation (section 38):** there is no "search as I move the map." The discovery API
takes a point + radius, not a viewport bounding box, so panning/zooming the map never re-queries
it — the map only ever shows the already-loaded result set's geo-tagged events.

## PWA

`app/manifest.ts` (native App Router support, no extra tooling) + `app/icon.svg` (a small,
original vector mark — no third-party assets). `public/sw.js` is a deliberately minimal
service worker: install/activate lifecycle only, **no fetch interception, no caching of any
kind**. It exists purely for installability/future extensibility.

It specifically does **not** cache event discovery responses, event detail responses, or map
tiles — cultural listings go stale fast, and stale data here would be worse than no offline
data at all. No Serwist/Workbox was added; Next's manifest support alone is enough for
installability at this stage.

## Privacy / geolocation

- No login, no account, no user profile.
- No tracking cookies, no fingerprinting, no analytics SDK (Google Analytics, Meta Pixel, etc.)
  — that's a deliberate exclusion from this milestone, pending a real data policy.
- Geolocation is requested **only** after the user explicitly taps "Perto de mim" — never on
  page load. The resulting coordinates go into that one request's URL (rounded to ~11m
  precision — plenty for an urban-scale point+radius query, nowhere near the raw GPS
  precision the browser reports) and nowhere else: never `localStorage`, never a cookie,
  never sent to any third party.

## Known gaps (explicit, not silently worked around)

- **"Acontecendo agora"** is not implemented. A date-only occurrence never means "happening
  all day" (ADR-0014), so the backend has no honest way to answer "what's happening right
  now" — M7 never implemented that semantic, and this milestone doesn't fake it with an
  inactive/fake button.
- **"Última verificação"** (last-verified timestamp) is not shown. The public API contract
  doesn't expose it — inventing a date would be worse than omitting the section.
- **Cross-source duplicates are not merged in the UI.** The M6/M6.1 deduplication engine
  exists but isn't wired into ingestion or discovery — the fixture dataset's two
  independently-sourced "Rock in Porto Alegre" listings both appear as distinct cards. No
  client-side "hide duplicates" heuristic was added to paper over this; it's a backend
  integration gap, not something the frontend should silently fix.
- **Performers are not shown on the event detail page.** The public `Event` schema doesn't
  include a `performers` field — nothing was invented client-side to fill that gap.
- **`notFound()` returns HTTP 200, not 404 (M9 correction).** A `notFound()`-triggered page
  (e.g. `/eventos/<unknown-slug>`) renders the correct "not found" UI, but this build was
  observed returning HTTP 200 for that response. This is Next.js's documented **streamed
  `notFound()` behavior**, not a framework bug: the route segment has a `loading.tsx`
  sibling, so the response starts streaming (and its 200 status line is already sent) before
  the Server Component's `notFound()` call is reached — a status code can't be changed
  retroactively once streaming has begun. A non-streamed route (no `loading.tsx` in the
  chain) sets 404 correctly. M9 deliberately does not change `loading.tsx`/the streaming UX
  just to correct this status code — that trade-off (perceived-load-speed via streaming vs.
  a technically-correct 404 status on a rare not-found path) is a product decision for a
  future milestone, not something to flip silently here.

## E2E

Playwright (`@playwright/test`, pinned exact version), Chromium only for now. Real stack —
Postgres → fixtures → Fastify API → Next Web → Playwright — never a mocked API (M8 section 63).

```bash
docker compose up -d postgres
pnpm db:migrate
pnpm ingest:ticketmaster:fixture
pnpm ingest:destino-poa:fixture
pnpm build            # e2e runs the production build, not next dev
pnpm e2e:install       # once, installs the Chromium binary
pnpm e2e
```

`e2e/playwright.config.ts` starts both servers itself (`webServer`, an array — API then Web)
and tears them down after the run in CI; locally it reuses already-running servers on the
same ports if present.

**Clock discipline (section 64):** "Hoje"/"Fim de semana" tests only assert that the shortcut
updates the URL and the page still renders successfully — never specific event content, since
the fixture dataset's dates are fixed but the real clock moves. Content assertions instead use
a fixed custom `start`/`end` range and the `free`/`category`/`q` filters, which stay
deterministic regardless of when the suite runs. No clock-override backdoor was added to the
production server for this — see section 64's own explicit prohibition.

Covered: home loads, Hoje/Fim de semana shortcuts, Grátis, search (match + empty state),
category filter, custom date range, "Carregar mais" pagination, opening an event detail page
and navigating back, ticket/source links, the "internal fields never shown" invariant, share
(clipboard fallback), Lista→Mapa toggle, a geolocated marker's popup link, "Perto de mim" with
mocked geolocation (both granted and denied), and the not-found page. MapLibre's own tile
rendering is never asserted on — only product-level behavior (M8 section 66).

### Test pyramid (M10.1 section 32)

```text
Unit                        — packages/**/*.test.ts, apps/**/*.test.ts (vitest). Pure
                               functions, normalizers, dedup signals/scoring, formatting.
                               Fastest, most numerous, run on every save.
↓
Database/API integration    — vitest tests that hit a real Postgres (repositories, discovery
                               queries, the Fastify server itself via `server.test.ts`).
                               Real DB, real SQL, no mocked persistence layer.
↓
UI/E2E functional           — e2e/tests/*.spec.ts except visual-smoke.spec.ts (`pnpm e2e`).
                               Real stack end to end. discovery/detail/map-nearby/dedup cover
                               product flows; filter-composition.spec.ts specifically guards
                               against stale-client-state bugs (query state + visible result +
                               excluded result, every time — see that file's own header
                               comment); images.spec.ts proves the three image states (valid/
                               broken/missing) render correctly through the real stack.
↓
Visual regression           — e2e/tests/visual-smoke.spec.ts (`pnpm e2e:visual`, its own CI
                               job — see .github/workflows/ci.yml's `visual` job). Four
                               baselines only: home desktop/mobile, one filtered state, one
                               event-detail-with-image state. Catches CSS/layout regressions
                               unit and functional tests can't see; never auto-updated on
                               failure — a diff always needs a human decision
                               (`pnpm e2e:visual:update` after reviewing it).
↓
Manual exploratory          — docs/quality/UI_EXPLORATORY_CHECKLIST.md. A short pre-staging
                               pass a human runs by hand for the things automation is weakest
                               at (does this actually feel right, not just "does the assertion
                               pass").
```

Each layer catches what the one above it structurally cannot: unit tests can't catch a stale
React client-state bug (the state itself is correct in isolation; it's *which props reach it,
when* that's wrong) — that needs a real browser navigation, which is exactly what
filter-composition.spec.ts's "query state + visible + excluded" pattern is for. Visual
regression, in turn, catches a card that renders semantically correct DOM but looks visually
broken (overlapping text, a broken aspect ratio) — something no `getByRole`/`getByText`
assertion would ever notice.

### Image quality gate (M10.1 sections 7-17)

Three image states are deliberately tested as three separate conditions, not folded into one
"image works" test — they have different root causes and different correct behavior:

- **valid** — `apps/web/public/test-assets/event-cover.svg` (CULT's own synthetic asset, no
  third-party image) via a dedicated E2E-seeded event (`e2e/tests/support/valid-image-event.ts`,
  shared by `images.spec.ts` and `visual-smoke.spec.ts`). Proves the `<img>` is visible, has the
  expected `src`/`alt`, and actually finished loading (`naturalWidth`/`naturalHeight > 0`) —
  presence of the element alone is not treated as success.
- **broken** — reuses the Destino POA golden fixture's `example.invalid` image URL on purpose
  (a request to that reserved TLD is guaranteed to fail, with no real internet dependency).
  Proves `EventImage` swaps to the CULT fallback placeholder and never leaves a native
  broken-image icon in the DOM.
- **missing** — `image_url: null` (the Ticketmaster golden fixture event with no `images`
  array). A semantically different condition from "broken" (no request was ever attempted, vs.
  one that failed) and tested separately for that reason.

`EventImage`'s fallback placeholder carries `data-testid="event-image-placeholder"` purely as a
stable E2E hook (it stays `aria-hidden` and decorative — the visible event title is always
adjacent text, so no accessible name is needed on the placeholder itself). A valid image now
gets a real `alt` (the event title) instead of the previous always-empty `alt=""`, on both the
card and the detail page.
