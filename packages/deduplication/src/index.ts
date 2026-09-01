// Reserved for the future Deduplication Engine (similarity scoring, matching, merge). No
// engine implemented yet — see docs/adr/ once that milestone starts. What exists today is
// tooling for the cross-source Golden Dataset (test-data/golden-events/deduplication/),
// which the future engine will be developed and evaluated against.
export * from "./golden-dataset/types.js";
export * from "./golden-dataset/loader.js";
export * from "./golden-dataset/validator.js";
export * from "./golden-dataset/summary.js";
