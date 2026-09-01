import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEvent } from "../../../lib/api/client";
import { formatOccurrence, formatPrice, presentCategoryLabelFromId, presentStatusLabel } from "../../../lib/format/index";
import { buildEventJsonLd } from "../../../lib/schema/event-jsonld";
import { EventImage } from "../../../components/EventImage";
import { EventMapSection } from "../../../components/EventMapSection";
import { ShareButton } from "../../../components/ShareButton";
import styles from "./page.module.css";

function getSiteUrl(): string {
  return process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000";
}

interface EventPageParams {
  readonly slug: string;
}

interface EventPageProps {
  readonly params: Promise<EventPageParams>;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) return {};

  const url = `${getSiteUrl()}/eventos/${event.slug}`;
  const description = event.description ?? undefined;

  return {
    title: event.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: event.title,
      description,
      url,
      images: event.image_url ? [{ url: event.image_url }] : undefined,
    },
  };
}

export default async function EventDetailPage({ params }: EventPageProps) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const url = `${getSiteUrl()}/eventos/${event.slug}`;
  const jsonLd = buildEventJsonLd(event, url);
  const price = formatPrice(event);
  const statusLabel = presentStatusLabel(event.status);
  const hasGeo = event.venue?.latitude != null && event.venue?.longitude != null;
  const mapsUrl = hasGeo
    ? `https://www.openstreetmap.org/?mlat=${event.venue!.latitude}&mlon=${event.venue!.longitude}#map=17/${event.venue!.latitude}/${event.venue!.longitude}`
    : null;

  return (
    <article className={styles.article}>
      {/* Schema.org JSON-LD — content is built entirely from the public API contract via
          buildEventJsonLd, never raw HTML from any external source. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <EventImage src={event.image_url} alt="" />

      <div className={styles.body}>
        {statusLabel ? <p className={styles.status}>{statusLabel}</p> : null}
        {event.category ? <p className={styles.category}>{presentCategoryLabelFromId(event.category)}</p> : null}
        <h1 className={styles.title}>{event.title}</h1>

        {event.occurrences.length > 0 ? (
          <ul className={styles.occurrences}>
            {event.occurrences.map((occurrence, index) => (
              <li key={index}>{formatOccurrence(occurrence)}</li>
            ))}
          </ul>
        ) : null}

        {event.description ? <p className={styles.description}>{event.description}</p> : null}

        {event.venue ? (
          <section className={styles.section} aria-labelledby="venue-heading">
            <h2 id="venue-heading" className={styles.sectionHeading}>
              Local
            </h2>
            <p className={styles.venueName}>{event.venue.name}</p>
            {event.venue.address ? <p>{event.venue.address}</p> : null}
            <p>
              {[event.venue.neighborhood, event.venue.city].filter(Boolean).join(", ")}
            </p>
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className={styles.mapLink}>
                Ver no mapa
              </a>
            ) : null}
          </section>
        ) : null}

        {hasGeo ? (
          <section className={styles.section} aria-label="Mapa do local">
            <EventMapSection event={event} />
          </section>
        ) : null}

        {price ? (
          <section className={styles.section}>
            <h2 className={styles.sectionHeading}>Preço</h2>
            <p>{price}</p>
          </section>
        ) : null}

        <div className={styles.actions}>
          {event.ticket_url ? (
            <a href={event.ticket_url} target="_blank" rel="noopener noreferrer" className={styles.ticketButton}>
              Ver ingresso
            </a>
          ) : null}
          <ShareButton title={event.title} url={url} />
        </div>

        {event.sources.length > 0 ? (
          <section className={styles.section} aria-labelledby="sources-heading">
            <h2 id="sources-heading" className={styles.sectionHeading}>
              {event.sources.length > 1 ? "Fontes" : "Fonte"}
            </h2>
            <ul className={styles.sources}>
              {event.sources.map((source) => (
                <li key={source.source_id}>
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.source_id}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
