# ADR-0015 — Production Data Gate

## Status
Accepted

## Context
M10 (Beta Readiness) requires that CULT never start a public beta backed by a source whose
production use is not documented and authorized. Before this ADR, `commercialUse`
(`allowed | restricted | unknown`, ADR-0013's neighbor concept) already modeled exactly this
question at the source-definition level, but nothing turned it into an enforced release
decision — a developer could still run a live ingestion command against a `restricted` or
`unknown` source in any environment, including a hypothetical production one, as long as the
Ticketmaster-specific `TICKETMASTER_LIVE_PERSIST_ACK` development flag was set.

M10 explicitly warns against introducing a second, separate field (e.g. a `productionUse`
enum) that would duplicate what `commercialUse` already expresses.

## Decision
1. `evaluateProductionGate(source: SourceDefinition)` (`packages/domain/src/production-data-gate.ts`)
   is the single, pure, auditable function that turns `commercialUse` into a release decision:
   - `commercialUse: "allowed"` → `status: "approved"`
   - `commercialUse: "restricted"` → `status: "blocked"`, reason: commercial/legal approval required
   - `commercialUse: "unknown"` → `status: "blocked"`, reason: reuse rights not confirmed
   No second field is introduced. There is exactly one place a source's production
   authorization can be read from.
2. `pnpm sources:production-status` (`apps/worker/src/commands/sources-production-status.ts`)
   prints this decision for every known source (`ALL_SOURCE_DEFINITIONS` in
   `packages/config/src/sources.ts`), so the current gate state is always visible without
   reading code.
3. `checkProductionSourceAllowed(cultEnv, source)` (`apps/worker/src/production-source-gate.ts`)
   fails closed: outside `CULT_ENV=production` it is a no-op (staging/development may use any
   source, per M10's TECHNICAL STAGING vs PUBLIC BETA distinction); in production, a `blocked`
   source's live-persisting ingestion command exits non-zero with a clear message instead of
   warning and continuing. This is layered on top of — and independent from —
   `TICKETMASTER_LIVE_PERSIST_ACK` (`live-ingestion-gate.ts`): the ACK is a development
   control-flow convenience, never treated as production legal/commercial authorization.
4. `manual-beta` (`packages/config/src/sources.ts`) is the one source registered with
   `commercialUse: "allowed"` out of the box — because every event ingested through it is
   entered by a human who already holds the rights to the content (see
   `docs/sources/manual-beta.md`), not because an automated connector's licensing was
   relaxed.

## Consequences
- As of M10, `evaluateProductionGate` reports Ticketmaster and Destino POA both `blocked`.
  Public Beta cannot be marked ready until at least one automated source's `commercialUse`
  changes to `allowed` following a real legal/commercial review, or `manual-beta` alone is
  judged sufficient for a given beta scope.
- Any future connector must set a real `commercialUse` at the time it's added; there is no
  default that silently approves production persistence.
- This ADR does not change `commercialUse` on any existing source — see ADR-0013 and each
  source's `docs/sources/*.md` for that.
