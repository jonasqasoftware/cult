import type { CanonicalEvent } from "@cult/domain";

// Maps the internal CanonicalEvent to the public API shape declared in openapi/cult-api.yaml
// (snake_case at the API boundary; camelCase internally — this is the one translation layer).
export function toEventResponse(event: CanonicalEvent) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description ?? null,
    status: event.status,
    category: event.categoryId ?? null,
    occurrences: event.occurrences.map((occurrence) => ({
      starts_at: occurrence.startsAt.toISOString(),
      ends_at: occurrence.endsAt ? occurrence.endsAt.toISOString() : null,
      timezone: occurrence.timezone,
      status: occurrence.status,
    })),
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
  };
}
