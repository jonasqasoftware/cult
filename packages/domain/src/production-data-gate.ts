import type { SourceDefinition } from "./types/source-definition.js";

export type ProductionGateStatus = "approved" | "blocked";

export interface ProductionGateDecision {
  readonly sourceId: string;
  readonly status: ProductionGateStatus;
  readonly reason: string;
}

// M10 section 3 — the single, auditable mechanism deciding whether a source may persist
// live data in a public production environment. Deliberately derived from `commercialUse`
// rather than a second, separate field: `commercialUse` already models exactly this
// yes/no/unknown question (M10 explicitly warns against duplicating the concept), so this
// function is the ONE place that turns it into a release decision — see ADR-0015.
//
// "restricted" and "unknown" both block, for different, documented reasons: restricted means
// a provider's terms are known and require legal/commercial clearance CULT does not yet
// have; unknown means no reuse/licensing terms have been confirmed at all. Neither is
// downgraded to a looser status just because the underlying reason differs.
export function evaluateProductionGate(source: SourceDefinition): ProductionGateDecision {
  switch (source.commercialUse) {
    case "allowed":
      return { sourceId: source.id, status: "approved", reason: "commercialUse=allowed" };
    case "restricted":
      return { sourceId: source.id, status: "blocked", reason: "commercial/legal approval required" };
    case "unknown":
      return { sourceId: source.id, status: "blocked", reason: "reuse rights not confirmed" };
  }
}
