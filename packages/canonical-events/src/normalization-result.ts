import type { CanonicalEvent } from "@cult/domain";

// Shared shape every connector's normalizer returns — no throwing across the connector
// boundary. An `ok: false` result means the raw payload is preserved (ADR-0006/0013) but no
// CanonicalEvent could be honestly built from it right now (missing/unmappable data, a
// domain-model gap such as ADR-0014, etc.) — never a guess.
export type NormalizationResult =
  | { readonly ok: true; readonly event: CanonicalEvent }
  | { readonly ok: false; readonly reason: string };
