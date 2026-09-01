"use client";

import { useState } from "react";
import styles from "./EventImage.module.css";

// Client-only because a broken-image fallback needs an onError handler (section 23). Every
// other card element stays server-rendered; this is the one small, justified exception.
export function EventImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={styles.placeholder} aria-hidden="true">
        <span className={styles.placeholderMark}>C</span>
      </div>
    );
  }

  // Plain <img>, not next/image: source images come from multiple external ingestion
  // sources with unpredictable domains — next/image's remotePatterns allowlist isn't worth
  // maintaining per-source for an MVP1 card image.
  return <img src={src} alt={alt} loading="lazy" className={styles.image} onError={() => setFailed(true)} />;
}
