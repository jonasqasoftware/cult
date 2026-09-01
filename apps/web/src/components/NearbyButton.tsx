"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "../lib/analytics/track";
import type { DiscoveryFilters } from "../lib/api/types";
import { buildDiscoveryHref, omitFilters } from "../lib/url/discovery-query";
import styles from "./FilterChips.module.css";
import geoStyles from "./NearbyButton.module.css";

const DEFAULT_RADIUS_METERS = 5000;

// M8 sections 28-30: never requests location on load — only after this explicit click. The
// resulting lat/lng only ever go into this request's URL (rounded to a coarse, urban-scale
// precision by buildDiscoveryHref) — never written to localStorage, a cookie, or sent
// anywhere else. If the user denies permission, CULT stays fully usable without it.
export function NearbyButton({ filters }: { filters: DiscoveryFilters }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "locating" | "denied">("idle");
  const active = filters.lat !== undefined && filters.lng !== undefined;

  function handleClick() {
    if (active) {
      router.push(buildDiscoveryHref(omitFilters(filters, ["lat", "lng", "radius"]), { includeCursor: false }));
      return;
    }

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("denied");
      return;
    }

    track("nearby_used");
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus("idle");
        const nextFilters: DiscoveryFilters = {
          ...filters,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          radius: DEFAULT_RADIUS_METERS,
        };
        router.push(buildDiscoveryHref(nextFilters, { includeCursor: false }));
      },
      () => {
        setStatus("denied");
      },
      { timeout: 10_000 },
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={styles.chip}
        aria-pressed={active}
        data-active={active || undefined}
        disabled={status === "locating"}
      >
        {status === "locating" ? "Localizando…" : "Perto de mim"}
      </button>
      <div role="status" aria-live="polite" className="visually-hidden">
        {status === "denied" ? "Não foi possível usar sua localização." : null}
      </div>
      {status === "denied" ? (
        <p className={geoStyles.notice}>
          Não foi possível usar sua localização. Você ainda pode explorar os eventos normalmente.
        </p>
      ) : null}
    </>
  );
}
