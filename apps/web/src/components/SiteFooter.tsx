import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p>
          CULT reúne informações de eventos culturais de Porto Alegre a partir de fontes públicas. Detalhes de
          ingresso e localização são responsabilidade de cada fonte original.
        </p>
      </div>
    </footer>
  );
}
