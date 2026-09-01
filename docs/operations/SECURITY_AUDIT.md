# Security Audit (M10 section 35)

A point-in-time audit of the areas section 35 calls out, run against the M10 beta-readiness
codebase. Not a substitute for a professional pentest before a commercially significant
launch — see `PRODUCTION_DATA_SOURCES.md` and `PRIVACY.md`/`/privacidade` for the same caveat
applied to data/legal review.

## Findings

| Area | Status | Notes |
| --- | --- | --- |
| Security headers | OK | `apps/web/next.config.mjs` sets `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy: geolocation=(self), camera=(), microphone=()` on every route (M8 section 72). No CSP — deliberate, documented trade-off: MapLibre GL's workers + configurable third-party tile origin make a safe strict CSP non-trivial to write without a dedicated pass; not attempted in M10. |
| External links | OK | Every external `<a target="_blank">` (ticket CTA, maps link, source attribution links in `apps/web/src/app/eventos/[slug]/page.tsx`) carries `rel="noopener noreferrer"`. |
| Server-only env / secret exposure | OK | `TICKETMASTER_API_KEY`, `DATABASE_URL` are read only in `apps/api`/`apps/worker`, never in `apps/web`. Every browser-visible env var is explicitly `NEXT_PUBLIC_*` (`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_MAP_TILE_URL`, `NEXT_PUBLIC_MAP_ATTRIBUTION`) and none carry secrets. `apps/web/src/lib/api/env.ts` comments that `CULT_API_BASE_URL` must never become `NEXT_PUBLIC_CULT_API_BASE_URL`. |
| Error message leakage | OK | API validation errors return RFC 9457 Problem Details with generic public `detail` text (verified: an invalid cursor returns 400 with a generic message, not the parser's internal error). Web's BFF routes (`/api/discovery`, `/api/analytics`) catch and translate errors instead of forwarding stack traces. Fastify's own request logs (pino, `logger: true`) record method/url/host/remoteAddress/statusCode only — no headers, no body. |
| Public routes | OK | Only the MVP surface is public: `/health`, `/ready`, `/v1/events`, `/v1/events/{slug}`, `/v1/categories`, `/v1/analytics` (API, private-network-only by design) and Web's own pages/BFF routes. No admin or operation-style endpoints exist. |
| Source secrets | OK | `TICKETMASTER_API_KEY` only ever reaches `apps/worker`'s live-ingestion command; never logged (checked `ingest-ticketmaster-live.ts` and the ticketmaster connector — the key is passed as a constructor field, never interpolated into a log line). |
| BFF parameter whitelist | OK | `/api/discovery` parses only the known discovery filters via the same `searchParamsToFilters` allowlist the page itself uses — arbitrary query params are dropped, not forwarded (not a generic proxy). `/api/analytics` accepts only `{event_name, event_id?, metadata}`, validated against `@cult/domain`'s `validateAnalyticsEvent` allowlist both in the BFF and again in the private API (defense in depth). |
| Analytics payload abuse | OK | `/api/analytics` (Web BFF) rejects bodies over 4096 bytes before parsing JSON; the private API (`POST /v1/analytics`) independently re-validates event name enum, metadata allowlist, and has its own body-size limit (413 verified in `apps/api/src/server.test.ts`). Analytics failures are swallowed (never block discovery/detail/ticket-click/share), per section 29. |
| Dependency audit (`pnpm audit`) | BLOCKED IN THIS SANDBOX | `pnpm audit` failed here with `ERR_PNPM_AUDIT_BAD_RESPONSE` / HTTP 426 — this sandbox's network path to `registry.npmjs.org` doesn't satisfy npm's TLS requirement, not a finding about the dependencies themselves. Re-run `pnpm audit` from an environment with normal registry access before sign-off; add any real, fixable, runtime-relevant findings to this table. |

## Known, accepted gaps

- No CSP (see Security headers row above) — accepted trade-off, not a launch blocker for a
  beta with no user accounts/PII beyond the analytics allowlist in `docs/operations` /
  `/privacidade`.
- `pnpm audit` not actually executed against a live registry in this environment — tracked as
  an open item in `BETA_RELEASE_CHECKLIST.md`, not silently assumed clean.

## How to re-run

```bash
pnpm audit
grep -rn 'target="_blank"' apps/web/src --include="*.tsx"   # spot-check rel=noopener noreferrer
grep -rn "NEXT_PUBLIC_" apps/web/src apps/web/next.config.mjs
```
