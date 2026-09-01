// M10 section 42/43 — the fallback source for beta when no automated provider has a
// documented production-safe commercialUse. Every event here is entered by a human who
// already holds the rights to the content (their own listing, or factual information they
// are authorized to publish) — see docs/sources/manual-beta.md. This DTO is the shape a
// curator (or a small future authoring tool) produces; the normalizer only ever sees this
// typed DTO, same discipline as every other connector.
export interface ManualEventDto {
  // Assigned by the curator — there is no scraped URL/id to derive one from, unlike
  // Destino POA. Must be stable across re-ingestion of the same file (idempotency).
  readonly id?: string;
  readonly title?: string;
  readonly description?: string;
  readonly startDate?: string; // "YYYY-MM-DD"
  readonly endDate?: string; // "YYYY-MM-DD"
  readonly startTime?: string; // "HH:mm"
  readonly endTime?: string; // "HH:mm"
  readonly venueName?: string;
  readonly address?: string;
  readonly neighborhood?: string;
  // M10.2 Phase C — optional; both or neither, never one alone (the normalizer rejects a
  // partial pair rather than silently dropping it). No geocoding: a curator (or a synthetic
  // dataset like test-data/ui-demo/) supplies real/approximate coordinates directly, the
  // normalizer never derives them from address/neighborhood text.
  readonly latitude?: number;
  readonly longitude?: number;
  readonly categories?: readonly string[];
  readonly free?: boolean;
  readonly priceValue?: number;
  // Required — this is what proves provenance/attribution for a manually-entered event
  // (section 24: source links are never removed). Not the same as ticketUrl.
  readonly sourceUrl?: string;
  readonly ticketUrl?: string;
  readonly imageUrl?: string;
  // Section 45 — an image is only ever shown if this is explicitly true. Absent/false
  // silently drops the image (falls back to CULT's own placeholder); it does not fail
  // ingestion, since a missing rights confirmation is not a data-quality defect in the
  // rest of the event.
  readonly imageRightsConfirmed?: boolean;
}

export interface ManualEventFeed {
  readonly events: readonly ManualEventDto[];
}
