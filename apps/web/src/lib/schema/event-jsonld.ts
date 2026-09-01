import type { CultEvent, EventStatus } from "../api/types";

// Only statuses with a genuinely correct schema.org EventStatusType mapping are included
// (section 47: "mapear status apenas quando puder fazê-lo corretamente"). schema.org has no
// "completed/ended" status type, so "completed" is deliberately left unmapped rather than
// guessed at.
const EVENT_STATUS_TYPE: Partial<Record<EventStatus, string>> = {
  scheduled: "https://schema.org/EventScheduled",
  cancelled: "https://schema.org/EventCancelled",
  postponed: "https://schema.org/EventPostponed",
  rescheduled: "https://schema.org/EventRescheduled",
};

interface EventJsonLdLocation {
  readonly "@type": "Place";
  readonly name: string;
  readonly address: {
    readonly "@type": "PostalAddress";
    readonly streetAddress?: string;
    readonly addressLocality: string;
    readonly addressRegion: string;
    readonly addressCountry: string;
  };
}

interface EventJsonLdOffer {
  readonly "@type": "Offer";
  readonly url: string;
  readonly priceCurrency?: string;
  readonly price?: number;
}

export interface EventJsonLd {
  readonly "@context": "https://schema.org";
  readonly "@type": "Event";
  readonly name: string;
  readonly url: string;
  readonly description?: string;
  readonly image?: string;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly eventStatus?: string;
  readonly location?: EventJsonLdLocation;
  readonly offers?: EventJsonLdOffer;
}

function resolveDates(event: CultEvent): { startDate?: string; endDate?: string } {
  const occurrence = event.occurrences[0];
  if (!occurrence) return {};

  if (occurrence.kind === "timed") {
    return {
      startDate: occurrence.starts_at,
      ...(occurrence.ends_at ? { endDate: occurrence.ends_at } : {}),
    };
  }
  return {
    startDate: occurrence.start_date,
    ...(occurrence.end_date ? { endDate: occurrence.end_date } : {}),
  };
}

function resolveLocation(event: CultEvent): { location?: EventJsonLdLocation } {
  if (!event.venue) return {};
  return {
    location: {
      "@type": "Place",
      name: event.venue.name,
      address: {
        "@type": "PostalAddress",
        ...(event.venue.address ? { streetAddress: event.venue.address } : {}),
        addressLocality: event.venue.city,
        addressRegion: event.venue.state,
        addressCountry: event.venue.country,
      },
    },
  };
}

function resolveOffers(event: CultEvent): { offers?: EventJsonLdOffer } {
  if (!event.ticket_url) return {};
  return {
    offers: {
      "@type": "Offer",
      url: event.ticket_url,
      ...(event.currency ? { priceCurrency: event.currency } : {}),
      ...(event.free === true ? { price: 0 } : event.price_min != null ? { price: event.price_min } : {}),
    },
  };
}

// Built only from the public API contract's canonical fields (M7 section 31/32 /
// M8 section 48) — never quality_score, ranking_score, source confidence, or any other
// internal/provisional field.
export function buildEventJsonLd(event: CultEvent, canonicalUrl: string): EventJsonLd {
  const statusType = EVENT_STATUS_TYPE[event.status];

  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.title,
    url: canonicalUrl,
    ...(event.description ? { description: event.description } : {}),
    ...(event.image_url ? { image: event.image_url } : {}),
    ...resolveDates(event),
    ...(statusType ? { eventStatus: statusType } : {}),
    ...resolveLocation(event),
    ...resolveOffers(event),
  };
}
