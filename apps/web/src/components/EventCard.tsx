import Link from "next/link";
import type { CultEvent } from "../lib/api/types";
import { formatDistance, formatOccurrence, formatPrice, presentStatusLabel } from "../lib/format/index";
import { EventImage } from "./EventImage";
import styles from "./EventCard.module.css";

export function EventCard({ event, categoryName }: { event: CultEvent; categoryName?: string | undefined }) {
  const occurrence = event.occurrences[0];
  const price = formatPrice(event);
  const statusLabel = presentStatusLabel(event.status);

  return (
    <li className={styles.card}>
      <Link href={`/eventos/${event.slug}`} className={styles.link}>
        <EventImage src={event.image_url} alt={event.title} />
        <div className={styles.body}>
          {statusLabel ? <p className={styles.status}>{statusLabel}</p> : null}
          {occurrence ? <p className={styles.date}>{formatOccurrence(occurrence)}</p> : null}
          <h3 className={styles.title}>{event.title}</h3>
          <p className={styles.meta}>
            {categoryName ? <span>{categoryName}</span> : null}
            {event.venue ? <span>{event.venue.name}</span> : null}
            {event.venue?.neighborhood ? <span>{event.venue.neighborhood}</span> : null}
          </p>
          <p className={styles.footer}>
            {price ? <span className={styles.price}>{price}</span> : null}
            {event.distance_meters !== undefined ? (
              <span className={styles.distance}>{formatDistance(event.distance_meters)}</span>
            ) : null}
          </p>
        </div>
      </Link>
    </li>
  );
}
