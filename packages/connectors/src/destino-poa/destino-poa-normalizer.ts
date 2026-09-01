import {
  createCanonicalEvent,
  createDateOnlyEventOccurrence,
  createEventSourceReference,
  createTimedEventOccurrence,
  createVenue,
  type EventOccurrence,
  type EventPrice,
  type Venue,
} from "@cult/domain";
import {
  buildEventSlug,
  generateSlug,
  PROVISIONAL_QUALITY_SCORE,
  PROVISIONAL_RANKING_SCORE,
  type NormalizationResult,
} from "@cult/canonical-events";
import type { DestinoPOAEventDto } from "./destino-poa-types.js";

export type { NormalizationResult };

// Documented hypothesis, not a magic number. Distinguish two different things:
//   - source AUTHORITY (packages/config: how much to trust this source as a curator of
//     "what's happening in Porto Alegre" overall — see DESTINO_POA_AUTHORITY_SCORE there);
//   - this per-EVENT-REFERENCE confidence, which is about how reliably THIS record's data
//     was extracted. Destino POA is an official city portal (reasonably trustworthy that
//     the event exists/is real) but the connector reads server-rendered HTML rather than a
//     validated API contract, so this sits below Ticketmaster's API-sourced 0.9.
export const DESTINO_POA_SOURCE_CONFIDENCE = 0.75;

export interface NormalizeDestinoPOAEventContext {
  readonly sourceId: string;
  readonly now: Date;
}

// Pure: no HTTP, no I/O, no system clock reads (context.now is injected by the caller).
export function normalizeDestinoPOAEvent(
  dto: DestinoPOAEventDto,
  context: NormalizeDestinoPOAEventContext,
): NormalizationResult {
  const externalId = extractExternalId(dto);
  if (!externalId) {
    return { ok: false, reason: "Destino POA event is missing a usable id/url slug" };
  }

  const title = dto.title?.trim();
  if (!title) {
    return { ok: false, reason: "Destino POA event has no name" };
  }

  const startDate = dto.startDate;
  if (!startDate) {
    return { ok: false, reason: "Destino POA event has no date at all" };
  }

  const id = `${context.sourceId}-${externalId}`;
  const sourceUrl = dto.url ?? `https://destinopoa.com.br/evento/${externalId}/`;

  try {
    const occurrence = buildOccurrence(dto, startDate, `${id}-occ-1`, id);

    const source = createEventSourceReference({
      sourceId: context.sourceId,
      externalId,
      url: sourceUrl,
      firstSeenAt: context.now,
      lastSeenAt: context.now,
      confidence: DESTINO_POA_SOURCE_CONFIDENCE,
    });

    const categories = (dto.categories ?? []).map((category) => generateSlug(category)).filter(Boolean);
    const categoryId = categories[0];
    const subcategories = categories.slice(1);

    const venue = buildVenue(dto);
    const price = buildPrice(dto);
    const description = dto.description?.trim() || undefined;

    const event = createCanonicalEvent({
      id,
      slug: buildEventSlug(title, context.sourceId, externalId),
      title,
      ...(description ? { description } : {}),
      ...(categoryId ? { categoryId } : {}),
      subcategories,
      status: "scheduled",
      occurrences: [occurrence],
      ...(venue ? { venue } : {}),
      performers: [],
      ...(price ? { price } : {}),
      accessibility: [],
      ...(dto.imageUrl ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.externalUrl ? { ticketUrl: dto.externalUrl } : {}),
      sources: [source],
      qualityScore: PROVISIONAL_QUALITY_SCORE,
      rankingScore: PROVISIONAL_RANKING_SCORE,
      firstSeenAt: context.now,
      lastSeenAt: context.now,
      createdAt: context.now,
      updatedAt: context.now,
    });

    return { ok: true, event };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

// dto is untrusted (ultimately derived from HTML scraping) — the same discipline M2.1
// applied to Ticketmaster's `id` applies here to whichever field stands in for identity.
function extractExternalId(dto: DestinoPOAEventDto): string | undefined {
  const id = dto.id?.trim();
  if (id) return id;

  const url = dto.url?.trim();
  if (!url) return undefined;
  const match = /\/evento\/([^/]+)\/?$/.exec(url);
  return match?.[1];
}

// ADR-0014 (Accepted): a specific time of day is only usable for a SINGLE day. A multi-day
// range with a time attached is contradictory source data (not expected in practice from
// this source) and degrades to a date-only range rather than misapplying that time across
// every day. Everything else with a date but no time — single day or a range — becomes a
// DateOnlyEventOccurrence. Never invented: a time of day, or a date where none exists.
// startDate presence is already checked by the caller before this runs (passed separately,
// rather than narrowing dto.startDate in place, to keep exactOptionalPropertyTypes happy).
function buildOccurrence(
  dto: DestinoPOAEventDto,
  startDate: string,
  occurrenceId: string,
  eventId: string,
): EventOccurrence {
  const isSingleDay = !dto.endDate || dto.endDate === startDate;

  if (dto.startTime && isSingleDay) {
    const startsAt = new Date(`${startDate}T${dto.startTime}:00-03:00`);
    if (!Number.isNaN(startsAt.getTime())) {
      let endsAt: Date | undefined;
      if (dto.endTime) {
        const parsedEnd = new Date(`${startDate}T${dto.endTime}:00-03:00`);
        if (!Number.isNaN(parsedEnd.getTime()) && parsedEnd.getTime() >= startsAt.getTime()) {
          endsAt = parsedEnd;
        }
      }
      return createTimedEventOccurrence({
        id: occurrenceId,
        eventId,
        startsAt,
        ...(endsAt ? { endsAt } : {}),
        status: "scheduled", // Destino POA does not publish cancellation/postponement status
      });
    }
  }

  return createDateOnlyEventOccurrence({
    id: occurrenceId,
    eventId,
    startDate,
    ...(dto.endDate ? { endDate: dto.endDate } : {}),
    status: "scheduled",
  });
}

// Destino POA is, by definition, Porto Alegre's own tourism/agenda portal — every event on
// it is in Porto Alegre/RS/BR. This is a known fact about the SOURCE itself, not an invented
// per-event guess (contrast with Ticketmaster, a global platform, where city/state/country
// must come from and be validated against each individual event record).
function buildVenue(dto: DestinoPOAEventDto): Venue | undefined {
  const name = dto.venueName?.trim();
  if (!name) return undefined;

  try {
    return createVenue({
      id: `venue-${generateSlug(name)}`,
      name,
      ...(dto.address ? { address: dto.address } : {}),
      ...(dto.neighborhood ? { neighborhood: dto.neighborhood } : {}),
      city: "Porto Alegre",
      state: "RS",
    });
  } catch {
    return undefined;
  }
}

function buildPrice(dto: DestinoPOAEventDto): EventPrice | undefined {
  if (dto.free === true) {
    return { free: true, currency: "BRL" };
  }
  if (dto.priceValue !== undefined) {
    return { free: false, min: dto.priceValue, max: dto.priceValue, currency: "BRL" };
  }
  return undefined;
}
