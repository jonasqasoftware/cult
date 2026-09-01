import Link from "next/link";
import styles from "../../not-found.module.css";

export default function EventNotFound() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.heading}>Evento não encontrado</h1>
      <p>Não encontramos o evento que você procurava.</p>
      <Link href="/" className={styles.link}>
        Voltar para a página inicial
      </Link>
    </div>
  );
}
