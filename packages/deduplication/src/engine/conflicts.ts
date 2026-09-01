import type { CanonicalEvent } from "@cult/domain";
import { geoDistanceMeters } from "../signals/geo.js";
import { textSimilarity } from "../signals/text.js";
import type { TemporalAssessment } from "../signals/temporal.js";

// Priority order per M6 spec section 26: detect the more objective conflicts
// (city/date/time/venue/edition) confidently; deliberately do NOT attempt to auto-detect
// event_scope_conflict or performer_conflict in M6 — both would need fragile heuristics
// with today's data. Missing data never counts as a conflict — it's absence of evidence.
export type DetectedConflict =
  | "venue_conflict"
  | "date_conflict"
  | "time_conflict"
  | "city_conflict"
  | "edition_conflict";

// Beyond this, two venues are objectively not the same physical place, regardless of how
// similar their names read.
const VENUE_GEO_CONFLICT_METERS = 1500;
// With no geo evidence, only flag a conflict when names are confidently unrelated — avoid
// misreading a plausible alias/abbreviation as a conflict.
const VENUE_NAME_CONFLICT_THRESHOLD = 0.2;

const YEAR_TOKEN_PATTERN = /\b(19|20)\d{2}\b/;

export function detectConflicts(
  left: CanonicalEvent,
  right: CanonicalEvent,
  temporal: Pick<TemporalAssessment, "conflict">,
): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];

  if (temporal.conflict) {
    conflicts.push(temporal.conflict);
  }

  if (left.venue && right.venue) {
    if (left.venue.city !== right.venue.city) {
      conflicts.push("city_conflict");
    }

    const distance = geoDistanceMeters(left.venue, right.venue);
    if (distance !== undefined) {
      if (distance > VENUE_GEO_CONFLICT_METERS) {
        conflicts.push("venue_conflict");
      }
    } else if (textSimilarity(left.venue.name, right.venue.name) < VENUE_NAME_CONFLICT_THRESHOLD) {
      conflicts.push("venue_conflict");
    }
  }

  const leftYear = left.title.match(YEAR_TOKEN_PATTERN)?.[0];
  const rightYear = right.title.match(YEAR_TOKEN_PATTERN)?.[0];
  if (leftYear && rightYear && leftYear !== rightYear) {
    conflicts.push("edition_conflict");
  }

  return conflicts;
}
