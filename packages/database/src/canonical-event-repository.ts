import { eq, type SQL } from "drizzle-orm";
import { createCanonicalEvent, type CanonicalEvent, type CanonicalEventRepositoryPort } from "@cult/domain";
import { eventOccurrences, events, eventSources, venues } from "./schema.js";
import type { Database } from "./client.js";

// Only save / findById / findBySlug — matching the M1/M2 port contract exactly. Discovery
// queries (pagination, filters) are NOT part of this port; see list-canonical-events.ts,
// which apps/api calls directly as a separate, explicitly-scoped read query.
export function createCanonicalEventRepository(db: Database): CanonicalEventRepositoryPort {
  return {
    async save(event: CanonicalEvent): Promise<void> {
      await db.transaction(async (tx) => {
        if (event.venue) {
          const venue = event.venue;
          const venueValues = {
            name: venue.name,
            address: venue.address ?? null,
            neighborhood: venue.neighborhood ?? null,
            city: venue.city,
            state: venue.state,
            country: venue.country,
            latitude: venue.latitude ?? null,
            longitude: venue.longitude ?? null,
          };
          await tx
            .insert(venues)
            .values({ id: venue.id, ...venueValues })
            .onConflictDoUpdate({ target: venues.id, set: venueValues });
        }

        const eventValues = {
          slug: event.slug,
          title: event.title,
          description: event.description ?? null,
          categoryId: event.categoryId ?? null,
          subcategories: [...event.subcategories],
          status: event.status,
          venueId: event.venue?.id ?? null,
          organizer: event.organizer ?? null,
          performers: [...event.performers],
          price: event.price ?? null,
          ageRating: event.ageRating ?? null,
          accessibility: [...event.accessibility],
          imageUrl: event.imageUrl ?? null,
          ticketUrl: event.ticketUrl ?? null,
          canonicalUrl: event.canonicalUrl ?? null,
          qualityScore: event.qualityScore,
          rankingScore: event.rankingScore,
          firstSeenAt: event.firstSeenAt,
          lastSeenAt: event.lastSeenAt,
          lastVerifiedAt: event.lastVerifiedAt ?? null,
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        };

        await tx
          .insert(events)
          .values({ id: event.id, ...eventValues })
          .onConflictDoUpdate({ target: events.id, set: eventValues });

        await tx.delete(eventOccurrences).where(eq(eventOccurrences.eventId, event.id));
        if (event.occurrences.length > 0) {
          await tx.insert(eventOccurrences).values(
            event.occurrences.map((occurrence) => ({
              id: occurrence.id,
              eventId: event.id,
              startsAt: occurrence.startsAt,
              endsAt: occurrence.endsAt ?? null,
              timezone: occurrence.timezone,
              status: occurrence.status,
            })),
          );
        }

        await tx.delete(eventSources).where(eq(eventSources.eventId, event.id));
        if (event.sources.length > 0) {
          await tx.insert(eventSources).values(
            event.sources.map((source) => ({
              eventId: event.id,
              sourceId: source.sourceId,
              externalId: source.externalId ?? null,
              url: source.url,
              firstSeenAt: source.firstSeenAt,
              lastSeenAt: source.lastSeenAt,
              lastVerifiedAt: source.lastVerifiedAt ?? null,
              confidence: source.confidence,
            })),
          );
        }
      });
    },

    async findById(id: string): Promise<CanonicalEvent | null> {
      return loadCanonicalEvent(db, eq(events.id, id));
    },

    async findBySlug(slug: string): Promise<CanonicalEvent | null> {
      return loadCanonicalEvent(db, eq(events.slug, slug));
    },
  };
}

export async function loadCanonicalEvent(db: Database, where: SQL): Promise<CanonicalEvent | null> {
  const eventRows = await db.select().from(events).where(where).limit(1);
  const eventRow = eventRows[0];
  if (!eventRow) return null;

  const venueRow = eventRow.venueId
    ? (await db.select().from(venues).where(eq(venues.id, eventRow.venueId)).limit(1))[0]
    : undefined;

  const occurrenceRows = await db
    .select()
    .from(eventOccurrences)
    .where(eq(eventOccurrences.eventId, eventRow.id));

  const sourceRows = await db.select().from(eventSources).where(eq(eventSources.eventId, eventRow.id));

  return createCanonicalEvent({
    id: eventRow.id,
    slug: eventRow.slug,
    title: eventRow.title,
    ...(eventRow.description !== null ? { description: eventRow.description } : {}),
    ...(eventRow.categoryId !== null ? { categoryId: eventRow.categoryId } : {}),
    subcategories: eventRow.subcategories,
    status: eventRow.status as CanonicalEvent["status"],
    occurrences: occurrenceRows.map((row) => ({
      id: row.id,
      eventId: row.eventId,
      startsAt: row.startsAt,
      ...(row.endsAt !== null ? { endsAt: row.endsAt } : {}),
      timezone: row.timezone as "America/Sao_Paulo",
      status: row.status as CanonicalEvent["status"],
    })),
    ...(venueRow
      ? {
          venue: {
            id: venueRow.id,
            name: venueRow.name,
            ...(venueRow.address !== null ? { address: venueRow.address } : {}),
            ...(venueRow.neighborhood !== null ? { neighborhood: venueRow.neighborhood } : {}),
            city: venueRow.city,
            state: venueRow.state,
            country: venueRow.country as "BR",
            ...(venueRow.latitude !== null ? { latitude: venueRow.latitude } : {}),
            ...(venueRow.longitude !== null ? { longitude: venueRow.longitude } : {}),
          },
        }
      : {}),
    ...(eventRow.organizer !== null ? { organizer: eventRow.organizer } : {}),
    performers: eventRow.performers,
    ...(eventRow.price !== null ? { price: eventRow.price } : {}),
    ...(eventRow.ageRating !== null ? { ageRating: eventRow.ageRating } : {}),
    accessibility: eventRow.accessibility,
    ...(eventRow.imageUrl !== null ? { imageUrl: eventRow.imageUrl } : {}),
    ...(eventRow.ticketUrl !== null ? { ticketUrl: eventRow.ticketUrl } : {}),
    ...(eventRow.canonicalUrl !== null ? { canonicalUrl: eventRow.canonicalUrl } : {}),
    sources: sourceRows.map((row) => ({
      sourceId: row.sourceId,
      ...(row.externalId !== null ? { externalId: row.externalId } : {}),
      url: row.url,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      ...(row.lastVerifiedAt !== null ? { lastVerifiedAt: row.lastVerifiedAt } : {}),
      confidence: row.confidence,
    })),
    qualityScore: eventRow.qualityScore,
    rankingScore: eventRow.rankingScore,
    firstSeenAt: eventRow.firstSeenAt,
    lastSeenAt: eventRow.lastSeenAt,
    ...(eventRow.lastVerifiedAt !== null ? { lastVerifiedAt: eventRow.lastVerifiedAt } : {}),
    createdAt: eventRow.createdAt,
    updatedAt: eventRow.updatedAt,
  });
}
