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
import type { ManualEventDto } from "./manual-types.js";

export type { NormalizationResult };

// Manually curated by a human who already holds the rights to what they entered (section 42)
// — no HTML-scraping/API-mapping uncertainty in between. Highest confidence of any source
// connector; still below 1.0 because entry/typo errors remain possible.
export const MANUAL_SOURCE_CONFIDENCE = 0.95;

export interface NormalizeManualEventContext {
  readonly sourceId: string;
  readonly now: Date;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// Pure: no I/O, no system clock reads (context.now is injected by the caller) — same
// discipline as every other connector's normalizer.
export function normalizeManualEvent(
  dto: ManualEventDto,
  context: NormalizeManualEventContext,
): NormalizationResult {
  const externalId = dto.id?.trim();
  if (!externalId) {
    return { ok: false, reason: "Manual event is missing an id" };
  }

  const title = dto.title?.trim();
  if (!title) {
    return { ok: false, reason: "Manual event has no title" };
  }

  const startDate = dto.startDate;
  if (!startDate) {
    return { ok: false, reason: "Manual event has no startDate" };
  }

  // Venue is required for manual entries, unlike Destino POA/Ticketmaster where it is
  // optional — a manually curated event is expected to carry complete, human-verified
  // location data (section 44), not partial scraped data.
  const venueName = dto.venueName?.trim();
  if (!venueName) {
    return { ok: false, reason: "Manual event has no venue" };
  }

  const sourceUrl = dto.sourceUrl?.trim();
  if (!sourceUrl || !isValidHttpUrl(sourceUrl)) {
    return { ok: false, reason: "Manual event has no valid sourceUrl (required for provenance/attribution)" };
  }

  if (dto.ticketUrl && !isValidHttpUrl(dto.ticketUrl)) {
    return { ok: false, reason: "Manual event ticketUrl is not a valid URL" };
  }

  if (dto.imageUrl && !isValidHttpUrl(dto.imageUrl)) {
    return { ok: false, reason: "Manual event imageUrl is not a valid URL" };
  }

  if (dto.priceValue !== undefined && (!Number.isFinite(dto.priceValue) || dto.priceValue < 0)) {
    return { ok: false, reason: "Manual event priceValue must be a non-negative number" };
  }

  // M10.2 Phase C — both or neither, never one alone: a lone coordinate is worse than none
  // (it would place a marker at an unintended point, e.g. the equator/prime meridian if the
  // missing half defaulted to 0), so it's rejected outright rather than silently dropped.
  // Range validation (-90..90 / -180..180) is Venue's own job (createVenue, called below) —
  // not duplicated here.
  if ((dto.latitude !== undefined) !== (dto.longitude !== undefined)) {
    return { ok: false, reason: "Manual event must provide both latitude and longitude, or neither" };
  }

  const id = `${context.sourceId}-${externalId}`;

  try {
    const occurrence = buildOccurrence(dto, startDate, `${id}-occ-1`, id);

    const source = createEventSourceReference({
      sourceId: context.sourceId,
      externalId,
      url: sourceUrl,
      firstSeenAt: context.now,
      lastSeenAt: context.now,
      confidence: MANUAL_SOURCE_CONFIDENCE,
    });

    const categories = (dto.categories ?? []).map((category) => generateSlug(category)).filter(Boolean);
    const categoryId = categories[0];
    const subcategories = categories.slice(1);

    const venue = buildVenue(venueName, dto);
    const price = buildPrice(dto);
    const description = dto.description?.trim() || undefined;

    // Section 45 — only ever carried forward when explicitly confirmed; otherwise dropped
    // silently (never fails ingestion) so the Web falls back to CULT's own placeholder image.
    const includeImage = Boolean(dto.imageUrl) && dto.imageRightsConfirmed === true;

    const event = createCanonicalEvent({
      id,
      slug: buildEventSlug(title, context.sourceId, externalId),
      title,
      ...(description ? { description } : {}),
      ...(categoryId ? { categoryId } : {}),
      subcategories,
      status: "scheduled",
      occurrences: [occurrence],
      venue,
      performers: [],
      ...(price ? { price } : {}),
      accessibility: [],
      ...(includeImage ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.ticketUrl ? { ticketUrl: dto.ticketUrl } : {}),
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

// Same date-only/timed split discipline as Destino POA (ADR-0014): a time of day is only
// ever attached to a single day, never invented across a multi-day range.
function buildOccurrence(
  dto: ManualEventDto,
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
        status: "scheduled",
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

// Manual entries are Porto Alegre by construction (the same reasoning as Destino POA) —
// every manual-beta event is entered specifically for this product's Porto Alegre scope.
function buildVenue(venueName: string, dto: ManualEventDto): Venue {
  return createVenue({
    id: `venue-${generateSlug(venueName)}`,
    name: venueName,
    ...(dto.address ? { address: dto.address } : {}),
    ...(dto.neighborhood ? { neighborhood: dto.neighborhood } : {}),
    city: "Porto Alegre",
    state: "RS",
    ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
    ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
  });
}

function buildPrice(dto: ManualEventDto): EventPrice | undefined {
  if (dto.free === true) {
    return { free: true, currency: "BRL" };
  }
  if (dto.priceValue !== undefined) {
    return { free: false, min: dto.priceValue, max: dto.priceValue, currency: "BRL" };
  }
  return undefined;
}
