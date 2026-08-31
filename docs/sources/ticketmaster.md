# Source: Ticketmaster

**Status: RESTRICTED / LEGAL REVIEW REQUIRED FOR COMMERCIAL PRODUCTION**

## API

- **Name:** Ticketmaster Discovery API
- **Version:** v2
- **Base endpoint:** `https://app.ticketmaster.com/discovery/v2/`
- **Search endpoint used:** `GET /events.json`
- **Authentication:** `apikey` query parameter (a secret; never logged, never sent to the
  browser, never committed).

## Coverage — Brazil / Porto Alegre

Ticketmaster's Discovery API covers events globally, but per-city coverage varies by market
and is not guaranteed. CULT queries with `countryCode=BR` and `city=Porto Alegre`. An empty
result set for Porto Alegre on a given day is expected behavior, not a connector defect — see
ADR discussion in the M2 execution report.

## Filters used by the CULT connector

- `countryCode=BR`
- `city=Porto Alegre`
- `page`, `size` (pagination)
- `startDateTime`, `endDateTime` (optional date window)

`latlong` is deprecated upstream and is not used. Geosearch against Ticketmaster is out of
scope for M2.

## Rate limits (as documented by Ticketmaster)

- 5 requests/second (default)
- 5,000 calls/day (default quota)

The client enforces a simple, explicit minimum-interval throttle between requests (no queue,
no Redis, no external rate-limit service) and treats HTTP 429 as a distinct, retryable error
type surfaced to the caller.

## Retention policy

Ticketmaster's terms restrict indefinite storage/caching of Event Content and require the
ability to remove content on request. CULT does **not** treat "never discard the raw payload"
(the general Raw Event Store rule) as "retain forever" for this source — see
[ADR-0013](../adr/0013-source-specific-retention-policy.md). `raw_events.retention_until` is
technically supported for Ticketmaster rows; the exact retention duration for production is
**not set** in this milestone and remains blocked on legal/commercial review. Fixture-derived
rows used in tests are exempt (synthetic data, not real Event Content).

## Commercial use

- **Restrictions include:** limits on caching/storing Event Content, an obligation to remove
  content on request, restrictions on commercial use, a prohibition on replicating
  Ticketmaster's core ticketing experience, and the rate limits above.
- **`commercialUse` in the Source Registry:** `"restricted"` — never `"allowed"`. This is a
  deliberate, hard-coded value; do not change it without a documented legal/commercial review.
- **Terms URL:** https://developer.ticketmaster.com/support/terms-of-use/ (summarized here,
  not reproduced — consult the current terms directly before any production decision).
- **Last reviewed:** 2026-08-31 (this document's authoring date; re-review before production
  use, as terms can change).

## Images

Image URLs returned by Ticketmaster are stored as references only (`imageUrl` on the
canonical event). CULT does not download, cache, mirror, or proxy Ticketmaster images.

## Running without an API key (default / CI)

All ingestion tests and the `pnpm ingest:ticketmaster:fixture` worker command run entirely
against a synthetic fixture at
`test-data/golden-events/ticketmaster/event-search-response.json`. No network access and no
`TICKETMASTER_API_KEY` are required. CI never sets this variable.

## Running against the live API (optional, local only)

1. Obtain a developer API key from https://developer.ticketmaster.com/.
2. Add `TICKETMASTER_API_KEY=...` to your local `.env` (never commit this file — it is
   git-ignored).
3. Run `pnpm ingest:ticketmaster` (see `apps/worker`).

If the key is absent, the live command fails fast with a clear error instead of silently
falling back to the fixture. It never blocks `test`, `build`, or CI.
