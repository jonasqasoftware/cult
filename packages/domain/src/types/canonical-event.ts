import { DomainValidationError } from "../errors.js";
import type { EventStatus } from "./event-status.js";
import type { EventOccurrence } from "./event-occurrence.js";
import type { Venue } from "./venue.js";
import type { Organizer } from "./organizer.js";
import type { Performer } from "./performer.js";
import type { EventPrice } from "./event-price.js";
import type { EventSourceReference } from "./event-source-reference.js";

// The provider-independent event at the center of CULT. qualityScore and rankingScore are
// part of the contract only in M1 — their calculation lands in later milestones.
export interface CanonicalEvent {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly categoryId?: string;
  readonly subcategories: readonly string[];
  readonly status: EventStatus;
  readonly occurrences: readonly EventOccurrence[];
  readonly venue?: Venue;
  readonly organizer?: Organizer;
  readonly performers: readonly Performer[];
  readonly price?: EventPrice;
  readonly ageRating?: string;
  readonly accessibility: readonly string[];
  readonly imageUrl?: string;
  readonly ticketUrl?: string;
  readonly canonicalUrl?: string;
  readonly sources: readonly EventSourceReference[];
  readonly qualityScore: number;
  readonly rankingScore: number;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly lastVerifiedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface CreateCanonicalEventInput {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly categoryId?: string;
  readonly subcategories?: readonly string[];
  readonly status: EventStatus;
  readonly occurrences: readonly EventOccurrence[];
  readonly venue?: Venue;
  readonly organizer?: Organizer;
  readonly performers?: readonly Performer[];
  readonly price?: EventPrice;
  readonly ageRating?: string;
  readonly accessibility?: readonly string[];
  readonly imageUrl?: string;
  readonly ticketUrl?: string;
  readonly canonicalUrl?: string;
  readonly sources: readonly EventSourceReference[];
  readonly qualityScore: number;
  readonly rankingScore: number;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly lastVerifiedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function createCanonicalEvent(input: CreateCanonicalEventInput): CanonicalEvent {
  if (input.title.trim().length === 0) {
    throw new DomainValidationError("CanonicalEvent: title must not be empty");
  }
  if (input.slug.trim().length === 0) {
    throw new DomainValidationError("CanonicalEvent: slug must not be empty");
  }
  if (input.occurrences.length === 0) {
    throw new DomainValidationError("CanonicalEvent: at least one occurrence is required");
  }
  if (input.sources.length === 0) {
    throw new DomainValidationError("CanonicalEvent: at least one source is required");
  }
  if (input.qualityScore < 0 || input.qualityScore > 1) {
    throw new DomainValidationError("CanonicalEvent: qualityScore must be between 0 and 1");
  }
  if (input.firstSeenAt.getTime() > input.lastSeenAt.getTime()) {
    throw new DomainValidationError("CanonicalEvent: firstSeenAt must not be after lastSeenAt");
  }
  if (input.createdAt.getTime() > input.updatedAt.getTime()) {
    throw new DomainValidationError("CanonicalEvent: createdAt must not be after updatedAt");
  }

  return {
    id: input.id,
    slug: input.slug,
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
    subcategories: input.subcategories ?? [],
    status: input.status,
    occurrences: input.occurrences,
    ...(input.venue !== undefined ? { venue: input.venue } : {}),
    ...(input.organizer !== undefined ? { organizer: input.organizer } : {}),
    performers: input.performers ?? [],
    ...(input.price !== undefined ? { price: input.price } : {}),
    ...(input.ageRating !== undefined ? { ageRating: input.ageRating } : {}),
    accessibility: input.accessibility ?? [],
    ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
    ...(input.ticketUrl !== undefined ? { ticketUrl: input.ticketUrl } : {}),
    ...(input.canonicalUrl !== undefined ? { canonicalUrl: input.canonicalUrl } : {}),
    sources: input.sources,
    qualityScore: input.qualityScore,
    rankingScore: input.rankingScore,
    firstSeenAt: input.firstSeenAt,
    lastSeenAt: input.lastSeenAt,
    ...(input.lastVerifiedAt !== undefined ? { lastVerifiedAt: input.lastVerifiedAt } : {}),
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}
