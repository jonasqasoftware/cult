"use client";

import dynamic from "next/dynamic";
import { useId, useState } from "react";
import type { CultEvent, DiscoveryFilters } from "../lib/api/types";
import { EventCard } from "./EventCard";
import styles from "./ResultsView.module.css";

// Map is heavy (MapLibre GL) and most sessions never open it — keep it out of the initial
// bundle entirely (section 58) and only fetch it once the user actually toggles to map view.
const MapView = dynamic(() => import("./MapView").then((m) => m.MapView), {
  ssr: false,
  loading: () => (
    <p className={styles.mapLoading} role="status">
      Carregando mapa…
    </p>
  ),
});

export interface ResultsViewProps {
  readonly initialEvents: readonly CultEvent[];
  readonly initialNextCursor: string | null;
  readonly filters: DiscoveryFilters;
  readonly categoryLabelsById: Readonly<Record<string, string>>;
}

export function ResultsView({ initialEvents, initialNextCursor, filters, categoryLabelsById }: ResultsViewProps) {
  const [events, setEvents] = useState(initialEvents);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const liveRegionId = useId();

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoading(true);
    setLoadError(false);
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined) params.set(key, String(value));
      }
      params.set("cursor", nextCursor);

      const response = await fetch(`/api/discovery?${params.toString()}`);
      if (!response.ok) throw new Error("load-more-failed");
      const body = (await response.json()) as { data: CultEvent[]; pagination: { next_cursor: string | null } };
      setEvents((current) => [...current, ...body.data]);
      setNextCursor(body.pagination.next_cursor);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  const geoTaggedEvents = events.filter((event) => event.venue?.latitude != null && event.venue.longitude != null);

  return (
    <section aria-labelledby={liveRegionId}>
      <div className={styles.toolbar}>
        <h2 id={liveRegionId} className={styles.heading}>
          Eventos
        </h2>
        <div className={styles.viewToggle} role="group" aria-label="Modo de visualização">
          <button
            type="button"
            className={styles.toggleButton}
            aria-pressed={view === "list"}
            data-active={view === "list" || undefined}
            onClick={() => setView("list")}
          >
            Lista
          </button>
          <button
            type="button"
            className={styles.toggleButton}
            aria-pressed={view === "map"}
            data-active={view === "map" || undefined}
            onClick={() => setView("map")}
          >
            Mapa
          </button>
        </div>
      </div>

      <div role="status" aria-live="polite" className="visually-hidden">
        {loading ? "Carregando mais eventos…" : `${events.length} eventos carregados.`}
      </div>

      {view === "map" ? (
        <MapView events={geoTaggedEvents} />
      ) : (
        <ul className={styles.grid} aria-label="Lista de eventos">
          {events.map((event) => (
            <EventCard key={event.id} event={event} categoryName={event.category ? categoryLabelsById[event.category] : undefined} />
          ))}
        </ul>
      )}

      {nextCursor ? (
        <div className={styles.loadMoreRow}>
          <button type="button" onClick={handleLoadMore} disabled={loading} className={styles.loadMoreButton}>
            {loading ? "Carregando…" : "Carregar mais"}
          </button>
          {loadError ? (
            <p role="alert" className={styles.loadError}>
              Não foi possível carregar mais eventos. Tente novamente.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
