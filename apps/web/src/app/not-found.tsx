import Link from "next/link";
import styles from "./not-found.module.css";

export default function NotFound() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.heading}>Página não encontrada</h1>
      <p>Não encontramos o que você procurava.</p>
      <Link href="/" className={styles.link}>
        Voltar para a página inicial
      </Link>
    </div>
  );
}
