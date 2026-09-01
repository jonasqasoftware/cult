import type { CanonicalEvent } from "@cult/domain";
import { titleSimilarity } from "../signals/title.js";
import { assessVenueText } from "../signals/venue.js";
import { geoDistanceMeters, geoSimilarity } from "../signals/geo.js";
import { assessTemporal } from "../signals/temporal.js";
import { performerOverlap } from "../signals/performer.js";
import { assessUrl } from "../signals/url.js";
import { detectConflicts, type DetectedConflict } from "./conflicts.js";
import { assessAutoMergeEligibility, type AutoMergeEligibility } from "./eligibility.js";
import { computeScore } from "./score.js";
import { decideRouting, type Routing } from "./routing.js";

export type { DetectedConflict } from "./conflicts.js";
export type { Routing } from "./routing.js";
export type { AutoMergeEligibility } from "./eligibility.js";

export interface DedupSignals {
  readonly title: number;
  readonly venue?: number;
  readonly temporal: number;
  readonly performer?: number;
  readonly geo?: number;
  readonly url?: number;
}

export interface DedupAssessment {
  readonly score: number;
  readonly routing: Routing;
  readonly signals: DedupSignals;
  readonly detectedConflicts: readonly DetectedConflict[];
  // M6.1: whether the evidence is strong enough for an irreversible auto_merge at all — a
  // separate axis from `score`. A perfect score can still be `autoMergeEligible: false` (e.g.
  // mixed temporal precision); see engine/eligibility.ts.
  readonly autoMergeEligible: boolean;
  readonly autoMergeBlockers: readonly string[];
  readonly reasons: readonly string[];
}

// The engine's only entry point. Pure function: no DB, no HTTP, no filesystem, no
// environment variables, no clock, no randomness — same input always yields the same
// output. Receives only the two CanonicalEvents; never a dataset case, label, or any
// golden-dataset-specific field. id/slug/sourceId/externalId are never read as signals.
export function assessDuplicate(left: CanonicalEvent, right: CanonicalEvent): DedupAssessment {
  const title = titleSimilarity(left.title, right.title);

  // M6 compares each event's first/primary occurrence — a documented limitation for events
  // with multiple occurrences (see README "Limitations").
  const leftOccurrence = left.occurrences[0];
  const rightOccurrence = right.occurrences[0];
  const temporalAssessment =
    leftOccurrence && rightOccurrence
      ? assessTemporal(leftOccurrence, rightOccurrence)
      : // Unreachable in practice — createCanonicalEvent requires at least one occurrence —
        // but TypeScript can't prove a readonly array is non-empty from its type alone.
        ({ compatible: false, similarity: 0, evidence: "date_pair" } as const);

  const venue = assessVenueText(left.venue, right.venue);
  const geoDistance = geoDistanceMeters(left.venue ?? {}, right.venue ?? {});
  const geo = geoDistance !== undefined ? geoSimilarity(geoDistance) : undefined;
  const performer = performerOverlap(left.performers, right.performers);
  const url = assessUrl(left, right);

  const detectedConflicts = detectConflicts(left, right, temporalAssessment);
  const eligibility = assessAutoMergeEligibility(temporalAssessment.evidence);

  const score = computeScore({
    title,
    temporal: temporalAssessment.similarity,
    ...(venue !== undefined ? { venue } : {}),
    ...(geo !== undefined ? { geo } : {}),
    ...(performer !== undefined ? { performer } : {}),
    ...(url !== undefined ? { url } : {}),
  });

  const routing = decideRouting(score, detectedConflicts, eligibility);

  const signals: DedupSignals = {
    title,
    temporal: temporalAssessment.similarity,
    ...(venue !== undefined ? { venue } : {}),
    ...(geo !== undefined ? { geo } : {}),
    ...(performer !== undefined ? { performer } : {}),
    ...(url !== undefined ? { url } : {}),
  };

  return {
    score,
    routing,
    signals,
    detectedConflicts,
    autoMergeEligible: eligibility.eligible,
    autoMergeBlockers: eligibility.blockers,
    reasons: buildReasons(signals, detectedConflicts, eligibility, routing),
  };
}

function buildReasons(
  signals: DedupSignals,
  conflicts: readonly DetectedConflict[],
  eligibility: AutoMergeEligibility,
  routing: Routing,
): string[] {
  const reasons: string[] = [];

  reasons.push(`title similarity: ${signals.title.toFixed(2)}`);
  reasons.push(
    signals.venue !== undefined ? `venue similarity: ${signals.venue.toFixed(2)}` : "venue: unknown (missing on one or both sides)",
  );
  reasons.push(`temporal similarity: ${signals.temporal.toFixed(2)}`);
  if (signals.geo !== undefined) reasons.push(`geo similarity: ${signals.geo.toFixed(2)}`);
  reasons.push(
    signals.performer !== undefined
      ? `performer overlap: ${signals.performer.toFixed(2)}`
      : "performer: unknown (missing on one or both sides)",
  );
  if (signals.url !== undefined) {
    reasons.push(signals.url === 1 ? "ticket/canonical URL matches exactly" : "URLs present but do not match");
  }

  if (conflicts.length > 0) {
    reasons.push(`critical conflicts detected: ${conflicts.join(", ")}`);
  } else {
    reasons.push("no critical conflicts detected");
  }

  if (!eligibility.eligible) {
    for (const blocker of eligibility.blockers) {
      reasons.push(`auto-merge blocked: ${blocker}`);
    }
  }

  reasons.push(`routing: ${routing}`);

  return reasons;
}
