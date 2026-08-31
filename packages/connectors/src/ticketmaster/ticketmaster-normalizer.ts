import {
  createCanonicalEvent,
  createEventOccurrence,
  createEventSourceReference,
  createVenue,
  type CanonicalEvent,
  type EventPrice,
  type EventStatus,
  type Performer,
  type Venue,
} from "@cult/domain";
import { generateSlug, PROVISIONAL_QUALITY_SCORE, PROVISIONAL_RANKING_SCORE } from "@cult/canonical-events";
import type {
  TicketmasterAttraction,
  TicketmasterDateInfo,
  TicketmasterEvent,
  TicketmasterPriceRange,
  TicketmasterVenue,
} from "./ticketmaster-types.js";

// Documented placeholder: a single, direct-from-provider source reference gets this fixed
// confidence in M2. Real per-source confidence modeling is a future milestone (dedup/ranking).
export const TICKETMASTER_SOURCE_CONFIDENCE = 0.9;

export interface NormalizeTicketmasterEventContext {
  readonly sourceId: string;
  readonly now: Date;
}

export type NormalizationResult =
  | { readonly ok: true; readonly event: CanonicalEvent }
  | { readonly ok: false; readonly reason: string };

// Pure: no HTTP, no I/O, no system clock reads (context.now is injected by the caller).
export function normalizeTicketmasterEvent(
  tmEvent: TicketmasterEvent,
  context: NormalizeTicketmasterEventContext,
): NormalizationResult {
  const title = tmEvent.name?.trim();
  if (!title) {
    return { ok: false, reason: "Ticketmaster event has no name" };
  }

  const status = mapStatus(tmEvent.dates?.status?.code);
  if (!status) {
    return {
      ok: false,
      reason: `Unmappable Ticketmaster status code: ${tmEvent.dates?.status?.code ?? "(none)"}`,
    };
  }

  const startsAt = resolveStartsAt(tmEvent.dates);
  if (!startsAt) {
    return { ok: false, reason: "Ticketmaster event has no usable start date" };
  }

  const id = `${context.sourceId}-${tmEvent.id}`;
  const sourceUrl = tmEvent.url ?? `https://www.ticketmaster.com/event/${tmEvent.id}`;

  try {
    const occurrence = createEventOccurrence({
      id: `${id}-occ-1`,
      eventId: id,
      startsAt,
      status,
    });

    const source = createEventSourceReference({
      sourceId: context.sourceId,
      externalId: tmEvent.id,
      url: sourceUrl,
      firstSeenAt: context.now,
      lastSeenAt: context.now,
      confidence: TICKETMASTER_SOURCE_CONFIDENCE,
    });

    const primaryClassification =
      tmEvent.classifications?.find((classification) => classification.primary) ??
      tmEvent.classifications?.[0];
    const categoryId = primaryClassification?.segment?.name
      ? generateSlug(primaryClassification.segment.name)
      : undefined;
    const subcategories = primaryClassification?.genre?.name
      ? [generateSlug(primaryClassification.genre.name)]
      : [];

    const venue = buildVenue(tmEvent._embedded?.venues?.[0]);
    const performers = buildPerformers(tmEvent._embedded?.attractions);
    const price = buildPrice(tmEvent.priceRanges);
    const imageUrl = tmEvent.images?.[0]?.url;
    const description = tmEvent.info?.trim() || undefined;

    const event = createCanonicalEvent({
      id,
      slug: generateSlug(title),
      title,
      ...(description ? { description } : {}),
      ...(categoryId ? { categoryId } : {}),
      subcategories,
      status,
      occurrences: [occurrence],
      ...(venue ? { venue } : {}),
      performers,
      ...(price ? { price } : {}),
      accessibility: [],
      ...(imageUrl ? { imageUrl } : {}),
      ticketUrl: sourceUrl,
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

function mapStatus(code: string | undefined): EventStatus | null {
  switch (code) {
    case "onsale":
    case "offsale":
      return "scheduled";
    case "cancelled":
      return "cancelled";
    case "postponed":
      return "postponed";
    case "rescheduled":
      return "rescheduled";
    default:
      return null;
  }
}

function resolveStartsAt(dates: TicketmasterDateInfo | undefined): Date | null {
  const dateTime = dates?.start?.dateTime;
  if (dateTime) {
    const parsed = new Date(dateTime);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const localDate = dates?.start?.localDate;
  if (localDate) {
    // No local time given — assume midnight in the MVP's fixed America/Sao_Paulo (-03:00) timezone.
    const parsed = new Date(`${localDate}T00:00:00-03:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function buildVenue(tmVenue: TicketmasterVenue | undefined): Venue | undefined {
  if (!tmVenue?.name || !tmVenue.city?.name || !tmVenue.state?.stateCode || !tmVenue.country?.countryCode) {
    return undefined;
  }
  // The domain Venue.country is currently BR-only (MVP scope) — don't invent a value for
  // anything else, just omit the venue.
  if (tmVenue.country.countryCode !== "BR") {
    return undefined;
  }

  const latitude = tmVenue.location?.latitude !== undefined ? Number(tmVenue.location.latitude) : undefined;
  const longitude = tmVenue.location?.longitude !== undefined ? Number(tmVenue.location.longitude) : undefined;

  try {
    return createVenue({
      id: tmVenue.id ?? `venue-${generateSlug(tmVenue.name)}`,
      name: tmVenue.name,
      ...(tmVenue.address?.line1 !== undefined ? { address: tmVenue.address.line1 } : {}),
      city: tmVenue.city.name,
      state: tmVenue.state.stateCode,
      ...(latitude !== undefined && !Number.isNaN(latitude) ? { latitude } : {}),
      ...(longitude !== undefined && !Number.isNaN(longitude) ? { longitude } : {}),
    });
  } catch {
    // A malformed venue (e.g. out-of-range coordinates) degrades to "no venue" rather than
    // failing the whole event — venue is optional on CanonicalEvent.
    return undefined;
  }
}

function buildPerformers(attractions: readonly TicketmasterAttraction[] | undefined): Performer[] {
  if (!attractions) return [];
  return attractions
    .filter((attraction): attraction is TicketmasterAttraction & { name: string } =>
      Boolean(attraction.name),
    )
    .map((attraction) => ({
      id: attraction.id ?? `performer-${generateSlug(attraction.name)}`,
      name: attraction.name,
    }));
}

function buildPrice(priceRanges: readonly TicketmasterPriceRange[] | undefined): EventPrice | undefined {
  const range = priceRanges?.[0];
  if (!range) return undefined;
  // MVP domain price is BRL-only — a non-BRL range degrades to "no price" rather than
  // misrepresenting the currency.
  if (range.currency !== undefined && range.currency !== "BRL") return undefined;

  const isFree = range.min === 0 && range.max === 0;
  return {
    free: isFree,
    ...(!isFree && range.min !== undefined ? { min: range.min } : {}),
    ...(!isFree && range.max !== undefined ? { max: range.max } : {}),
    currency: "BRL",
  };
}
