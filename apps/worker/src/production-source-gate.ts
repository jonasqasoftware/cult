import { evaluateProductionGate, type SourceDefinition } from "@cult/domain";
import type { CultEnv } from "@cult/config";

export type ProductionSourceGateResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

// Fail-closed check (M10 section 8) for any worker command that persists LIVE (non-fixture)
// data. A no-op outside production — staging/development may use any source regardless of
// its Production Data Gate status (M10 section 2: TECHNICAL STAGING vs PUBLIC BETA). In
// production, a source the gate reports "blocked" must never be allowed to persist, no
// matter what per-source developer ACK (e.g. TICKETMASTER_LIVE_PERSIST_ACK) is set — that
// ACK is a development control-flow convenience, never production legal/commercial
// authorization (M10 section 4, ADR-0015).
export function checkProductionSourceAllowed(
  cultEnv: CultEnv,
  source: SourceDefinition,
): ProductionSourceGateResult {
  if (cultEnv !== "production") {
    return { allowed: true };
  }

  const decision = evaluateProductionGate(source);
  if (decision.status === "blocked") {
    return {
      allowed: false,
      reason:
        `Refusing to persist live data for source "${source.id}" in production: ${decision.reason}. ` +
        "See docs/operations/PRODUCTION_DATA_SOURCES.md and `pnpm sources:production-status`.",
    };
  }

  return { allowed: true };
}
