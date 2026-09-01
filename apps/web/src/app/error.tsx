"use client";

import { useEffect } from "react";
import { ErrorState } from "../components/ErrorState";
import styles from "./error.module.css";

// Next App Router error boundary — a genuinely unexpected rendering error, distinct from the
// handled API-failure path already covered inline in page.tsx. Never shows the error's own
// message/stack to the user (section 9).
export default function HomeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Client-side error visibility until real observability tooling is wired up for the web
    // app — never shown to the user (see ErrorState below).
    console.error(error);
  }, [error]);

  return (
    <div className={styles.wrap}>
      <ErrorState retryHref="/" />
      <button type="button" onClick={reset} className={styles.reset}>
        Recarregar
      </button>
    </div>
  );
}
