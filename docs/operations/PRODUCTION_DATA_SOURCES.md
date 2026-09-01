# Production Data Sources

Authoritative only as of the last time `pnpm sources:production-status` was actually run.
Read that command's output as ground truth — this document explains the mechanism and current
state, not a promise that stays current forever.

## The Production Data Gate (ADR-0015)

Every source's `commercialUse` (`allowed | restricted | unknown`) is turned into a release
decision by `evaluateProductionGate` (`packages/domain/src/production-data-gate.ts`):

| commercialUse | production status | reason |
|---|---|---|
| `allowed` | **APPROVED** | — |
| `restricted` | **BLOCKED** | commercial/legal approval required |
| `unknown` | **BLOCKED** | reuse rights not confirmed |

Run `pnpm sources:production-status` for the live answer. No second field
(`productionUse`) exists — `commercialUse` is the single source of truth (see ADR-0015 for
why that was a deliberate choice, not an oversight).

## Current sources

- **Ticketmaster** (`ticketmaster.md`) — `commercialUse: restricted`. **BLOCKED.** The
  `TICKETMASTER_LIVE_PERSIST_ACK` env var is a development-only control-flow convenience for
  running a live ingestion locally with retention already understood to not be legally
  cleared — it is never treated as production authorization (M10 section 4). Changing this
  requires an actual legal/commercial review with Ticketmaster, documented in
  `ticketmaster.md` and ADR-0013.
- **Destino POA** (`destino-poa.md`) — `commercialUse: unknown`. **BLOCKED.** No reuse/
  licensing terms have been found for this HTML-scraped source. Changing this requires
  finding and documenting actual terms, or an explicit rights agreement.
- **Manual (Beta Curated Events)** (`manual-beta.md`) — `commercialUse: allowed`. **APPROVED.**
  Every event is entered by a human who already holds the rights to the content — see
  `manual-beta.md` for why this is a genuinely different rights basis, not a relaxation of
  the other two sources' licensing.
- **Porto Alegre Open Data** (`porto-alegre-open-data.md`) — investigated only, no
  `SourceDefinition` registered. Not a production source until an actual open-data-portal
  dataset (not just any Prefeitura-hosted page) is identified and its license confirmed.

## Fail-closed enforcement (M10 section 8)

`checkProductionSourceAllowed(cultEnv, source)` (`apps/worker/src/production-source-gate.ts`)
gates every live-persisting ingestion command. Outside `CULT_ENV=production` it is a no-op
(staging/development may use any source, fixtures included). In production, a `blocked`
source's ingestion command exits non-zero with a clear message — this is layered *on top of*
Ticketmaster's own `TICKETMASTER_LIVE_PERSIST_ACK` gate, not a replacement for it.

## Public Beta gate

Per M10 section 41/60: **Public Beta cannot be marked READY while zero automated production-
safe sources exist**, unless `manual-beta` alone is judged sufficient content for the beta's
actual scope. See `BETA_RELEASE_CHECKLIST.md` for the full gate.
