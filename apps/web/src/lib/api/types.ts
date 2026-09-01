// Mirrors openapi/cult-api.yaml exactly (snake_case, public boundary). Deliberately NOT the
// internal @cult/domain CanonicalEvent — the API has its own contract/boundary, and this
// frontend must only ever depend on what that contract actually documents (M7.1 section 67).

export type EventStatus = "scheduled" | "cancelled" | "postponed" | "rescheduled" | "completed";

export interface TimedEventOccurrence {
  readonly kind: "timed";
  readonly starts_at: string; // ISO instant
  readonly ends_at: string | null;
  readonly timezone: string;
  readonly status: EventStatus;
}

export interface DateOnlyEventOccurrence {
  readonly kind: "date";
  readonly start_date: string; // YYYY-MM-DD, calendar date — never an instant
  readonly end_date: string | null;
  readonly timezone: string;
  readonly status: EventStatus;
}

export type EventOccurrence = TimedEventOccurrence | DateOnlyEventOccurrence;

export interface Venue {
  readonly name: string;
  readonly address: string | null;
  readonly neighborhood: string | null;
  readonly city: string;
  readonly state: string;
  readonly country: string;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

export interface EventSource {
  readonly source_id: string;
  readonly external_id: string | null;
  readonly url: string;
  readonly confidence: number;
}

export interface CultEvent {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: EventStatus;
  readonly category: string | null;
  readonly occurrences: readonly EventOccurrence[];
  readonly venue: Venue | null;
  readonly free: boolean | null;
  readonly price_min: number | null;
  readonly price_max: number | null;
  readonly currency: string | null;
  readonly image_url: string | null;
  readonly ticket_url: string | null;
  readonly sources: readonly EventSource[];
  // quality_score / ranking_score exist on the wire but are internal/provisional — this type
  // deliberately omits them so no UI code can accidentally read and display them (M7 section
  // 18 / M7.1 review: never shown to the end user).
  readonly distance_meters?: number;
}

export interface EventListResponse {
  readonly data: readonly CultEvent[];
  readonly pagination: { readonly next_cursor: string | null };
}

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface CategoryListResponse {
  readonly data: readonly Category[];
}

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
}

export type Period = "today" | "tomorrow" | "weekend" | "this_week" | "this_month";

export interface DiscoveryFilters {
  readonly q?: string;
  readonly period?: Period;
  readonly start?: string;
  readonly end?: string;
  readonly category?: string;
  readonly free?: boolean;
  readonly lat?: number;
  readonly lng?: number;
  readonly radius?: number;
  readonly status?: EventStatus;
  readonly cursor?: string;
  readonly limit?: number;
}
