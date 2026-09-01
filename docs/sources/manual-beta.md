# Source: Manual (Beta Curated Events)

- `id`: `manual-beta`
- `type`: `manual`
- `commercialUse`: `allowed`
- Connector: `packages/connectors/src/manual/`
- Ingestion command: `pnpm ingest:manual -- <file.json>`

## What this is

M10's fallback beta data source (M10 section 42). Ticketmaster (`restricted`) and Destino
POA (`unknown`) are both `production: BLOCKED` per the Production Data Gate (ADR-0015,
`pnpm sources:production-status`) — no automated connector currently has a documented,
authorized path to persist live data in production. `manual-beta` exists so a public beta
can still launch with **real, rights-cleared** events, entered by a human, rather than either
relaxing an automated connector's licensing or launching with zero real content.

## Why `commercialUse: allowed` is honest here

Every other source's `commercialUse` describes a *scraped/API-fetched* provider whose terms
CULT does not control. `manual-beta` is different in kind: each event is entered by someone
who already holds the rights to what they're entering — their own event listing, or factual
information they are authorized to publish. `allowed` reflects that the *entry itself* is the
rights-clearance step, not a legal review of a third party's terms of service. This is not a
precedent for changing Ticketmaster's or Destino POA's `commercialUse` — those still require
an actual legal/commercial review (ADR-0013).

## Ingestion pipeline

Identical to every other connector — `RawSourceEvent -> normalize -> CanonicalEvent` via the
shared `runIngestion` composition root (`apps/worker/src/run-ingestion.ts`). Nothing is
inserted directly into `events`, so raw-store/provenance guarantees (ADR-0006) hold exactly
as they do for Ticketmaster/Destino POA.

## Input format

A JSON file shaped as `{ "events": ManualEventDto[] }` — see
`packages/connectors/src/manual/manual-types.ts` for the full field list, and
`test-data/golden-events/manual/events.json` for a worked example (also used by
`apps/worker/src/ingest-manual.test.ts`).

## Validation (M10 section 44) — a manual event is rejected, not guessed, when any of these
are missing/invalid

- `title` — required, non-blank.
- `startDate` — required.
- `venueName` — required (unlike Destino POA/Ticketmaster, where venue is optional: a
  manually curated event is expected to carry complete, human-verified data).
- `sourceUrl` — required, must be a valid `http(s)` URL. This is what proves
  provenance/attribution for a manually-entered event (section 24 — source links are never
  removed).
- `ticketUrl` / `imageUrl`, if present, must also be valid `http(s)` URLs.
- `priceValue`, if present, must be a non-negative number.
- `latitude` / `longitude` (M10.2 Phase C) — optional, but both or neither: a lone coordinate
  is rejected rather than silently dropped (it would otherwise place a marker at an unintended
  point). When both are present, each is range-validated the same way every other source's
  venue is (`Venue`'s own `createVenue`, `packages/domain/src/types/venue.ts`) — no geocoding
  is performed; a curator supplies real coordinates directly, the same as any other field.

Nothing here is ever invented — a missing optional field is simply omitted from the
resulting `CanonicalEvent`, never defaulted to a guessed value.

## Image rights (M10 section 45)

`imageUrl` is only ever carried into the `CanonicalEvent` when `imageRightsConfirmed: true`
is also set. Otherwise the image is silently dropped (not a normalization failure) and the
Web falls back to CULT's own placeholder (`apps/web/src/components/EventImage.tsx`). Do not
set `imageRightsConfirmed: true` for an image copied from a page/source without clear usage
rights.

## Content policy

- Do not copy descriptions or images from restricted third-party pages into a manual entry.
- Only factual information the curator is authorized to publish.
- `sourceUrl` should point at wherever the event is genuinely documented (the organizer's own
  page, an authorized listing, etc.) — not a page the event was copied from without
  permission.

## Retention

No source-specific retention restriction is known or needed — the content is CULT's own
authorized entry, not a third party's licensed feed. `retention_until` (ADR-0013) stays
unset for this source's raw events.
