import Link from "next/link";
import styles from "./StateMessage.module.css";

export function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className={styles.state} role="status">
      <p className={styles.message}>Nenhum evento encontrado com esses filtros.</p>
      <div className={styles.actions}>
        {hasFilters ? (
          <Link href="/" className={styles.action}>
            Limpar filtros
          </Link>
        ) : null}
        <Link href="/" className={styles.action}>
          Ver todos
        </Link>
      </div>
    </div>
  );
}
