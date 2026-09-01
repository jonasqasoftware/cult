// M6: an in-memory, pure-function deduplication engine — assesses two CanonicalEvents and
// returns an explainable score/routing. No persistence, no merge, no admin/API integration
// yet (see README.md "Limitations" and docs/adr/0015 if present).
export * from "./engine/assess.js";
export * from "./engine/conflicts.js";
export * from "./engine/eligibility.js";
export * from "./engine/score.js";
export * from "./engine/routing.js";

export * from "./signals/text.js";
export * from "./signals/title.js";
export * from "./signals/venue.js";
export * from "./signals/geo.js";
export * from "./signals/temporal.js";
export * from "./signals/performer.js";
export * from "./signals/url.js";

export * from "./golden-dataset/types.js";
export * from "./golden-dataset/loader.js";
export * from "./golden-dataset/validator.js";
export * from "./golden-dataset/summary.js";

export * from "./evaluation/partitions.js";
export * from "./evaluation/metrics.js";
export * from "./evaluation/evaluate.js";
