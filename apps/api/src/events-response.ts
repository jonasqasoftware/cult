import type { CanonicalEvent, EventOccurrence } from "@cult/domain";

// M4 (ADR-0014): EventOccurrence is a discriminated union. This switch must stay exhaustive —
// if a new `kind` is ever added to the domain, the `default` branch fails to compile (the
// unhandled value won't be assignable to `never`), not silently drop data at the API boundary.
function toOccurrenceResponse(occurrence: EventOccurrence) {
  switch (occurrence.kind) {
    case "timed":
      return {
        kind: "timed" as const,
        starts_at: occurrence.startsAt.toISOString(),
        ends_at: occurrence.endsAt ? occurrence.endsAt.toISOString() : null,
        timezone: occurrence.timezone,
        status: occurrence.status,
      };
    case "date":
      return {
        kind: "date" as const,
        start_date: occurrence.startDate,
        end_date: occurrence.endDate ?? null,
        timezone: occurrence.timezone,
        status: occurrence.status,
      };
    default: {
      const exhaustiveCheck: never = occurrence;
      throw new Error(`Unhandled EventOccurrence kind: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}

// Maps the internal CanonicalEvent to the public API shape declared in openapi/cult-api.yaml
// (snake_case at the API boundary; camelCase internally — this is the one translation layer).
// `distanceMeters` is only ever set for a `nearby` (lat/lng/radius) discovery query (section
// 31) — omitted from the response entirely otherwise, not sent as null.
export function toEventResponse(event: CanonicalEvent, distanceMeters?: number) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description ?? null,
    status: event.status,
    category: event.categoryId ?? null,
    occurrences: event.occurrences.map(toOccurrenceResponse),
    venue: event.venue
      ? {
          name: event.venue.name,
          address: event.venue.address ?? null,
          neighborhood: event.venue.neighborhood ?? null,
          city: event.venue.city,
          state: event.venue.state,
          country: event.venue.country,
          latitude: event.venue.latitude ?? null,
          longitude: event.venue.longitude ?? null,
        }
      : null,
    free: event.price ? event.price.free : null,
    price_min: event.price?.min ?? null,
    price_max: event.price?.max ?? null,
    currency: event.price?.currency ?? null,
    image_url: event.imageUrl ?? null,
    ticket_url: event.ticketUrl ?? null,
    sources: event.sources.map((source) => ({
      source_id: source.sourceId,
      external_id: source.externalId ?? null,
      url: source.url,
      confidence: source.confidence,
    })),
    quality_score: event.qualityScore,
    ranking_score: event.rankingScore,
    ...(distanceMeters !== undefined ? { distance_meters: distanceMeters } : {}),
  };
}
