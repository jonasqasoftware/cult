import Link from "next/link";
import styles from "./StateMessage.module.css";

// M8 section 9 — API unreachable must never take the page down with a stack trace. Generic,
// legible message + a real retry action; never SQL/hostname/stack (mirrors the API's own
// Problem Details discipline from M7.1).
export function ErrorState({ retryHref }: { retryHref: string }) {
  return (
    <div className={styles.state} role="alert">
      <p className={styles.message}>Não foi possível carregar os eventos agora.</p>
      <div className={styles.actions}>
        <Link href={retryHref} className={styles.action}>
          Tentar novamente
        </Link>
      </div>
    </div>
  );
}
