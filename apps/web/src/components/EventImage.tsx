"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./EventImage.module.css";

// Client-only because a broken-image fallback needs an onError handler (section 23). Every
// other card element stays server-rendered; this is the one small, justified exception.
export function EventImage({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // M10.1 section 12 (found via images.spec.ts's broken-image test) — SSR renders the <img>
  // tag before any JS runs, so the browser can start (and, for a very fast failure like an
  // immediately-rejected request, finish) loading it before React hydrates and attaches
  // `onError` below. That error event fires with no listener yet attached and is lost, so the
  // fallback never triggers even though the image genuinely failed. Checking `.complete` /
  // `naturalWidth` right after mount catches exactly that already-happened-before-hydration
  // case; a normal in-flight or successful load is unaffected, and a failure that happens
  // after mount is still caught by `onError` as before.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setFailed(true);
    }
  }, [src]);

  if (!src || failed) {
    // M10.1 section 14 — decorative (aria-hidden, no text alternative needed: the event
    // title is always rendered as visible adjacent text). data-testid is a stable E2E hook
    // for the two semantically-identical-but-causally-different fallback paths (missing vs.
    // broken image URL) without selecting by CSS class.
    return (
      <div className={styles.placeholder} aria-hidden="true" data-testid="event-image-placeholder">
        <span className={styles.placeholderMark}>C</span>
      </div>
    );
  }

  // Plain <img>, not next/image: source images come from multiple external ingestion
  // sources with unpredictable domains — next/image's remotePatterns allowlist isn't worth
  // maintaining per-source for an MVP1 card image.
  return (
    <img
      ref={imgRef}
      src={src}
      alt={alt}
      loading="lazy"
      className={styles.image}
      onError={() => setFailed(true)}
    />
  );
}
