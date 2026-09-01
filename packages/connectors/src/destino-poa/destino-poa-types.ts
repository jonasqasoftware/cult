// Destino POA has no public API or reliable JSON-LD (see docs/sources/destino-poa.md) — the
// only viable ingestion method found is server-rendered HTML. This DTO represents the
// ALREADY-EXTRACTED structure a collector produces after parsing that HTML (fixtures mirror
// this shape directly, per the M3 instruction to represent "what the collector observes"
// rather than embedding large raw HTML blobs). Parsing HTML into this shape is the
// adapter/collector's job; the normalizer only ever sees this typed DTO.
export interface DestinoPOAEventDto {
  readonly id?: string;
  readonly title?: string;
  readonly url?: string;
  readonly description?: string;
  // Dates are strings on purpose — the source frequently gives a date-only or ranged
  // value with no time of day at all (see ADR-0014). Only startDate+startTime together
  // are precise enough for EventOccurrence.startsAt.
  readonly startDate?: string; // "YYYY-MM-DD"
  readonly endDate?: string; // "YYYY-MM-DD" — present for multi-day ranges
  readonly startTime?: string; // "HH:mm", only when the site actually shows a time
  readonly endTime?: string; // "HH:mm"
  readonly venueName?: string;
  readonly address?: string;
  readonly neighborhood?: string;
  readonly categories?: readonly string[];
  readonly free?: boolean;
  readonly priceValue?: number; // a single clear BRL amount, when shown unambiguously
  readonly imageUrl?: string;
  readonly externalUrl?: string;
}

export interface DestinoPOAAgendaFeed {
  readonly events: readonly DestinoPOAEventDto[];
}
