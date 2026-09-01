import type { EventStatus } from "@cult/domain";

// JSON-safe representation of a CanonicalEvent for the golden dataset. Dates are ISO strings
// (never a JS Date — cases.json is plain JSON); the loader (loader.ts) converts each fixture
// into a REAL CanonicalEvent through the actual domain factories, so every case is validated
// by the same invariants production code obeys. This type does not replace CanonicalEvent —
// it is only the wire format for hand-authored test data.

export type OccurrenceFixture =
  | { readonly kind: "timed"; readonly startsAt: string; readonly endsAt?: string }
  | { readonly kind: "date"; readonly startDate: string; readonly endDate?: string };

export interface VenueFixture {
  readonly id: string;
  readonly name: string;
  readonly address?: string;
  readonly neighborhood?: string;
  readonly city?: string;
  readonly state?: string;
  readonly latitude?: number;
  readonly longitude?: number;
}

export interface PerformerFixture {
  readonly id: string;
  readonly name: string;
}

export interface PriceFixture {
  readonly free: boolean;
  readonly min?: number;
  readonly max?: number;
}

export interface SourceRefFixture {
  readonly sourceId: string;
  readonly externalId?: string;
  readonly url: string;
  readonly confidence?: number;
}

// One side of a dedup pair — provider-independent, exactly the shape the future dedup
// engine will compare (CanonicalEvent vs CanonicalEvent, never raw provider DTOs).
export interface CanonicalEventFixture {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly categoryId?: string;
  readonly subcategories?: readonly string[];
  readonly status?: EventStatus;
  readonly occurrence: OccurrenceFixture;
  readonly venue?: VenueFixture;
  readonly performers?: readonly PerformerFixture[];
  readonly price?: PriceFixture;
  readonly imageUrl?: string;
  readonly ticketUrl?: string;
  readonly canonicalUrl?: string;
  readonly source: SourceRefFixture;
}

export type IdentityTruth = "same" | "different" | "uncertain";
export type ExpectedRouting = "auto_merge" | "review" | "separate";
export type Difficulty = "easy" | "medium" | "hard";

// Keep this vocabulary small and closed — see README.md "Critical conflict vocabulary".
// Do not add a new value here without updating the README and the validator.
export const CRITICAL_CONFLICT_VOCABULARY = [
  "venue_conflict",
  "date_conflict",
  "time_conflict",
  "performer_conflict",
  "city_conflict",
  "event_scope_conflict",
  "edition_conflict",
] as const;
export type CriticalConflict = (typeof CRITICAL_CONFLICT_VOCABULARY)[number];

export interface DedupGoldenCase {
  readonly id: string;
  readonly description: string;
  readonly left: CanonicalEventFixture;
  readonly right: CanonicalEventFixture;
  // Ground truth: what the two records ACTUALLY represent. Never edit this to make an
  // algorithm's output look correct — see README.md "Label change policy".
  readonly identityTruth: IdentityTruth;
  // What a dedup engine should DO given the truth AND the available evidence. Distinct from
  // identityTruth — e.g. truth=same with weak evidence still routes to review, not auto_merge.
  readonly expectedRouting: ExpectedRouting;
  readonly criticalConflicts: readonly CriticalConflict[];
  readonly rationale: string;
  readonly tags: readonly string[];
  readonly difficulty: Difficulty;
}

export interface GoldenDataset {
  readonly version: number;
  readonly description: string;
  readonly cases: readonly DedupGoldenCase[];
}
