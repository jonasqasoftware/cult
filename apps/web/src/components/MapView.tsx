"use client";

import { LngLatBounds, MapLibreMap, Marker, NavigationControl, Popup } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { CultEvent } from "../lib/api/types";
import { formatOccurrence } from "../lib/format/index";
import { getMapTileAttribution, getMapTileUrl } from "../lib/map/tile-config";
import styles from "./MapView.module.css";

const PORTO_ALEGRE_CENTER: [number, number] = [-51.2177, -30.0346];

// M8 sections 31-38: complementary to the list, lazy-loaded (see ResultsView), pinned exact
// MapLibre version, OSM tiles requested only for the current viewport (MapLibre's own
// behavior — no prefetching/bulk download added here). Does NOT implement "search as I move
// the map": the discovery API takes a point+radius, not a viewport bounding box, so panning
// the map never re-queries it — a documented limitation, not a bug.
export function MapView({ events }: { events: readonly CultEvent[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: [getMapTileUrl()],
            tileSize: 256,
            attribution: getMapTileAttribution(),
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: PORTO_ALEGRE_CENTER,
      zoom: 11,
    });
    mapRef.current = map;

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    const markers: Marker[] = [];
    const bounds = new LngLatBounds();

    for (const event of events) {
      const lat = event.venue?.latitude;
      const lng = event.venue?.longitude;
      if (lat == null || lng == null) continue;

      const popupNode = document.createElement("div");
      popupNode.className = styles.popup ?? "";

      const titleLink = document.createElement("a");
      titleLink.href = `/eventos/${event.slug}`;
      titleLink.textContent = event.title;
      titleLink.className = styles.popupTitle ?? "";
      popupNode.appendChild(titleLink);

      const occurrence = event.occurrences[0];
      if (occurrence) {
        const dateEl = document.createElement("p");
        dateEl.textContent = formatOccurrence(occurrence);
        dateEl.className = styles.popupMeta ?? "";
        popupNode.appendChild(dateEl);
      }

      if (event.venue?.name) {
        const venueEl = document.createElement("p");
        venueEl.textContent = event.venue.name;
        venueEl.className = styles.popupMeta ?? "";
        popupNode.appendChild(venueEl);
      }

      const marker = new Marker({ color: "#c4401f" })
        .setLngLat([lng, lat])
        .setPopup(new Popup({ offset: 24 }).setDOMContent(popupNode))
        .addTo(map);
      markers.push(marker);
      bounds.extend([lng, lat]);
    }

    if (!bounds.isEmpty()) {
      map.fitBounds(bounds, { padding: 48, maxZoom: 15, animate: false });
    }

    return () => {
      for (const marker of markers) marker.remove();
      map.remove();
      mapRef.current = null;
    };
  }, [events]);

  return (
    <div>
      <div ref={containerRef} className={styles.map} role="application" aria-label="Mapa dos eventos" />
      {events.length === 0 ? (
        <p className={styles.empty}>Nenhum evento com localização conhecida nesta página de resultados.</p>
      ) : null}
    </div>
  );
}
