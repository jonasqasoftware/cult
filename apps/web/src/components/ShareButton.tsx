"use client";

import { useState } from "react";
import { track } from "../lib/analytics/track";
import styles from "./ShareButton.module.css";

// M8 section 45. Web Share API when available (mobile-first — this is where it matters
// most), falling back to copying the link with an accessible confirmation otherwise.
export function ShareButton({ title, url, eventId }: { title: string; url: string; eventId?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    track("share", eventId ? { eventId } : {});
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled the native share sheet — not an error to surface.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Clipboard access can be denied by the browser; there is no further honest fallback.
    }
  }

  return (
    <div>
      <button type="button" onClick={handleShare} className={styles.button}>
        Compartilhar
      </button>
      <div role="status" aria-live="polite" className="visually-hidden">
        {copied ? "Link copiado" : null}
      </div>
      {copied ? <span className={styles.confirmation}>Link copiado</span> : null}
    </div>
  );
}
