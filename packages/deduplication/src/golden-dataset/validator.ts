import {
  CRITICAL_CONFLICT_VOCABULARY,
  type CanonicalEventFixture,
  type GoldenDataset,
} from "./types.js";
import { buildDedupCases } from "./loader.js";

const MIN_CASES = 40;
const VALID_TRUTHS = ["same", "different", "uncertain"] as const;
const VALID_ROUTINGS = ["auto_merge", "review", "separate"] as const;

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

// Purely structural validation — no scoring, no similarity, no matching. Every check here is
// "is this dataset well-formed and complete," never "did an algorithm get the right answer."
export function validateGoldenDataset(dataset: GoldenDataset): ValidationResult {
  const errors: string[] = [];

  if (dataset.cases.length < MIN_CASES) {
    errors.push(`expected at least ${MIN_CASES} cases, found ${dataset.cases.length}`);
  }

  const caseIds = new Set<string>();
  const eventIds = new Set<string>();
  const seenTruths = new Set<string>();
  const seenRoutings = new Set<string>();
  let hasTimed = false;
  let hasDateOnly = false;
  let hasDateRange = false;

  for (const dedupCase of dataset.cases) {
    if (caseIds.has(dedupCase.id)) {
      errors.push(`duplicate case id: ${dedupCase.id}`);
    }
    caseIds.add(dedupCase.id);

    if (!VALID_TRUTHS.includes(dedupCase.identityTruth)) {
      errors.push(`${dedupCase.id}: invalid identityTruth "${dedupCase.identityTruth}"`);
    }
    seenTruths.add(dedupCase.identityTruth);

    if (!VALID_ROUTINGS.includes(dedupCase.expectedRouting)) {
      errors.push(`${dedupCase.id}: invalid expectedRouting "${dedupCase.expectedRouting}"`);
    }
    seenRoutings.add(dedupCase.expectedRouting);

    if (!dedupCase.rationale || dedupCase.rationale.trim().length === 0) {
      errors.push(`${dedupCase.id}: rationale must not be empty`);
    }

    if (!dedupCase.tags || dedupCase.tags.length === 0) {
      errors.push(`${dedupCase.id}: tags must not be empty`);
    }

    for (const conflict of dedupCase.criticalConflicts) {
      if (!(CRITICAL_CONFLICT_VOCABULARY as readonly string[]).includes(conflict)) {
        errors.push(`${dedupCase.id}: unknown critical conflict "${conflict}"`);
      }
    }

    for (const side of [dedupCase.left, dedupCase.right] as const) {
      if (eventIds.has(side.id)) {
        errors.push(`duplicate event fixture id: ${side.id} (case ${dedupCase.id})`);
      }
      eventIds.add(side.id);

      const kind = classifyOccurrence(side);
      if (kind === "timed") hasTimed = true;
      if (kind === "date") hasDateOnly = true;
      if (kind === "date-range") hasDateRange = true;
    }
  }

  for (const truth of VALID_TRUTHS) {
    if (!seenTruths.has(truth)) {
      errors.push(`dataset never uses identityTruth "${truth}"`);
    }
  }
  for (const routing of VALID_ROUTINGS) {
    if (!seenRoutings.has(routing)) {
      errors.push(`dataset never uses expectedRouting "${routing}"`);
    }
  }
  if (!hasTimed) errors.push("dataset has no timed occurrence");
  if (!hasDateOnly) errors.push("dataset has no date-only (single day) occurrence");
  if (!hasDateRange) errors.push("dataset has no date-only range occurrence");

  // Every fixture must actually construct through the real domain factories — this is what
  // proves the dataset operates on CanonicalEvent, not just JSON shaped like one.
  try {
    buildDedupCases(dataset);
  } catch (error) {
    errors.push(
      `one or more fixtures failed to construct via domain factories: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return { valid: errors.length === 0, errors };
}

function classifyOccurrence(fixture: CanonicalEventFixture): "timed" | "date" | "date-range" {
  if (fixture.occurrence.kind === "timed") return "timed";
  return fixture.occurrence.endDate !== undefined ? "date-range" : "date";
}
