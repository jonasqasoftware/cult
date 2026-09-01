export * from "./client.js";
export * from "./schema.js";
export * from "./ping.js";
export * from "./raw-event-repository.js";
export * from "./canonical-event-repository.js";
export * from "./load-canonical-events-by-ids.js";
export * from "./list-category-ids.js";
export * from "./source-repository.js";

// M7: Discovery API query layer — see discovery/discover-events.ts.
export * from "./discovery/period.js";
export * from "./discovery/date-range-filter.js";
export * from "./discovery/cursor.js";
export * from "./discovery/discover-events.js";

// M9: dedup persistence + presentation suppression — see dedup/*.
export * from "./dedup/pair.js";
export * from "./dedup/representative.js";
export * from "./dedup/candidate-repository.js";
export * from "./dedup/find-candidate-pairs.js";
export * from "./dedup/suppression.js";

// M9: honest, real operational metrics — see ops/summary.ts.
export * from "./ops/summary.js";

// M10: first-party product analytics persistence — see analytics/*.
export * from "./analytics/record-event.js";
export * from "./analytics/summary.js";
