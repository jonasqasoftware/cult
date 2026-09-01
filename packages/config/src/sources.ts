import { createInMemorySourceRegistry, createSourceDefinition, type SourceRegistryPort } from "@cult/domain";

// authorityScore hypothesis (not a magic number): Ticketmaster is a large, established,
// first-party ticketing platform — generally accurate for what it lists — but covers only
// ticketed commercial events, not the breadth of Porto Alegre's cultural agenda. 0.7 reflects
// "trustworthy for its own listings," not "authoritative for all of Porto Alegre culture."
// Recalibrate once real coverage/accuracy data exists. See docs/sources/ticketmaster.md.
const TICKETMASTER_AUTHORITY_SCORE = 0.7;

// pollingIntervalMinutes hypothesis: hourly polling is well within Ticketmaster's documented
// 5 req/s rate limit and 5,000 calls/day quota for a single-city query, while still keeping
// listings reasonably fresh. Not tuned against real traffic yet.
const TICKETMASTER_POLLING_INTERVAL_MINUTES = 60;

// commercialUse is deliberately "restricted", never "allowed" — see the Source Legal Gate in
// docs/sources/ticketmaster.md and ADR-0013. Do not change this without a documented legal/
// commercial review.
export const TICKETMASTER_SOURCE_DEFINITION = createSourceDefinition({
  id: "ticketmaster",
  name: "Ticketmaster Discovery API",
  type: "api",
  enabled: true,
  pollingIntervalMinutes: TICKETMASTER_POLLING_INTERVAL_MINUTES,
  authorityScore: TICKETMASTER_AUTHORITY_SCORE,
  commercialUse: "restricted",
  connector: "ticketmaster",
  termsUrl: "https://developer.ticketmaster.com/support/terms-of-use/",
  notes:
    "commercialUse=restricted per docs/sources/ticketmaster.md — do not change to 'allowed' without legal/commercial review.",
});

// authorityScore hypothesis: Destino POA is Porto Alegre's own official tourism/agenda
// portal — arguably BROADER local coverage than Ticketmaster (it lists free/informal events
// Ticketmaster never would), which argues for a score at least as high. But it's HTML-
// scraped rather than API-validated, and reuse/commercial rights are unconfirmed (see
// docs/sources/destino-poa.md), which argues for caution. 0.75 balances these — slightly
// above Ticketmaster's 0.7 for coverage breadth, not because it's "more official."
const DESTINO_POA_AUTHORITY_SCORE = 0.75;

// pollingIntervalMinutes hypothesis: no rate limit is documented (no public API exists to
// document one), so this is chosen conservatively to avoid being a bad citizen against a
// site with no API contract — checked far less often than Ticketmaster's API.
const DESTINO_POA_POLLING_INTERVAL_MINUTES = 240;

// commercialUse is deliberately "unknown", never "allowed" — see the Source Legal Gate in
// docs/sources/destino-poa.md and ADR-0013. type is "crawler", reflecting the actual method
// found (HTML scraping) — there is no public API to set type: "api" against.
export const DESTINO_POA_SOURCE_DEFINITION = createSourceDefinition({
  id: "destino-poa",
  name: "Destino POA — Agenda Cultural",
  type: "crawler",
  enabled: true,
  pollingIntervalMinutes: DESTINO_POA_POLLING_INTERVAL_MINUTES,
  authorityScore: DESTINO_POA_AUTHORITY_SCORE,
  commercialUse: "unknown",
  connector: "destino-poa",
  notes:
    "commercialUse=unknown per docs/sources/destino-poa.md — no reuse/licensing terms found yet; do not change to 'allowed' without a documented rights review. Live persistence is not implemented in M3 (fixture-only) — see docs/sources/destino-poa.md.",
});

export function createDevelopmentSourceRegistry(): SourceRegistryPort {
  return createInMemorySourceRegistry([TICKETMASTER_SOURCE_DEFINITION, DESTINO_POA_SOURCE_DEFINITION]);
}
