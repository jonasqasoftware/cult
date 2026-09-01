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

// M10 section 42 — the fallback beta source: every event ingested through it is entered by
// a human who already holds the rights to the content (their own listing, or factual
// information they're authorized to publish), so commercialUse is genuinely "allowed" here
// — this is not a relaxation of Ticketmaster/Destino POA's licensing, it is a different
// source with a different rights basis. See docs/sources/manual-beta.md.
export const MANUAL_BETA_SOURCE_DEFINITION = createSourceDefinition({
  id: "manual-beta",
  name: "Manual (Beta Curated Events)",
  type: "manual",
  enabled: true,
  // No polling — ingestion is a human-triggered `pnpm ingest:manual <file>`, not a
  // scheduled collector. The field is still required by SourceDefinition, so this is a
  // large, clearly-arbitrary placeholder rather than a value implying real polling.
  pollingIntervalMinutes: 1440,
  authorityScore: 0.6,
  commercialUse: "allowed",
  connector: "manual",
  notes:
    "commercialUse=allowed because every event is human-curated with confirmed rights — see docs/sources/manual-beta.md. Not a template for relaxing an automated connector's commercialUse.",
});

// M10.2 — a development/demo-only source so the Home page can be reviewed with visually rich,
// deterministic content (test-data/ui-demo/) instead of the golden fixtures' deliberately
// broken `example.invalid` images. Every event is entirely fictional (see
// docs/quality/UI_DEMO_DATASET.md) — there is no real-world rights question to resolve here,
// unlike Ticketmaster/Destino POA. `commercialUse: "restricted"` is used anyway, deliberately,
// purely to route this source through the exact same Production Data Gate mechanism
// (ADR-0015) that blocks any other unapproved source — never "allowed": this content must
// never reach production, permanently, by design, regardless of any future rights review.
// `pnpm demo:seed` (apps/worker/src/commands/demo-seed.ts) additionally refuses to run at all
// under CULT_ENV=production, as a second, independent guard — see that file's own comment.
export const UI_DEMO_SOURCE_DEFINITION = createSourceDefinition({
  id: "ui-demo",
  name: "UI Demo Dataset (development/demo only)",
  type: "manual",
  enabled: true,
  // No polling — ingestion is a human-triggered `pnpm demo:seed`, not a scheduled collector.
  pollingIntervalMinutes: 1440,
  authorityScore: 0,
  commercialUse: "restricted",
  connector: "ui-demo",
  notes:
    "Synthetic, fictional demo content for local UI/UX review only (M10.2) — never real-world " +
    "data. commercialUse=restricted here is not a rights classification (there are no rights " +
    "to clear for fictional content); it exists solely to keep this source blocked by the " +
    "Production Data Gate (ADR-0015) permanently. Never change to 'allowed'.",
});

// The single source of truth for "every source CULT knows about" — used by the development
// registry below and by `pnpm sources:production-status` (apps/worker/src/commands/
// sources-production-status.ts) so a new connector only has to be added here once.
export const ALL_SOURCE_DEFINITIONS = [
  TICKETMASTER_SOURCE_DEFINITION,
  DESTINO_POA_SOURCE_DEFINITION,
  MANUAL_BETA_SOURCE_DEFINITION,
  UI_DEMO_SOURCE_DEFINITION,
];

export function createDevelopmentSourceRegistry(): SourceRegistryPort {
  return createInMemorySourceRegistry(ALL_SOURCE_DEFINITIONS);
}
