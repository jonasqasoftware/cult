import Link from "next/link";
import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p>
          CULT reúne informações de eventos culturais de Porto Alegre a partir de fontes públicas. Detalhes de
          ingresso e localização são responsabilidade de cada fonte original.
        </p>
        <nav aria-label="Links institucionais" className={styles.links}>
          <Link href="/sobre">Sobre</Link>
          <Link href="/privacidade">Privacidade</Link>
        </nav>
      </div>
    </footer>
  );
}
