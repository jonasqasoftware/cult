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

export function createDevelopmentSourceRegistry(): SourceRegistryPort {
  return createInMemorySourceRegistry([TICKETMASTER_SOURCE_DEFINITION]);
}
