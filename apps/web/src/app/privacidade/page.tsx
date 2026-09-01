import type { Metadata } from "next";
import styles from "../legal-page.module.css";

export const metadata: Metadata = {
  title: "Privacidade",
  description: "Como o CULT trata dados e localização.",
};

// M10 section 22 — factual, not aspirational legal language. Marked for review before any
// commercially significant operation (see the note at the end of the page).
export default function PrivacyPage() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.heading}>Privacidade</h1>

      <p>
        O CULT foi construído para ajudar você a descobrir eventos culturais em Porto Alegre sem exigir
        cadastro, login ou perfil de usuário.
      </p>

      <h2>Sem login, sem perfil</h2>
      <p>
        Você pode buscar, filtrar e visualizar eventos livremente. Não é necessário criar conta, informar
        e-mail ou senha para usar o CULT.
      </p>

      <h2>Localização</h2>
      <ul>
        <li>Sua localização só é solicitada quando você toca em &quot;Perto de mim&quot; — nunca automaticamente.</li>
        <li>As coordenadas são usadas apenas para consultar eventos próximos naquele momento.</li>
        <li>O CULT não armazena sua localização em nenhum banco de dados.</li>
        <li>Se você negar a permissão, o restante do produto continua funcionando normalmente.</li>
      </ul>

      <h2>Analytics</h2>
      <p>
        Podemos registrar eventos de uso mínimos e agregados (por exemplo: uma página foi visitada, um
        evento foi aberto, um filtro foi usado) para entender se o produto está sendo útil. Esses registros
        não incluem nome, e-mail, login, localização geográfica precisa, identificadores de publicidade ou
        qualquer informação que permita identificar você individualmente. Veja mais detalhes em{" "}
        <a href="/sobre">Sobre</a>.
      </p>

      <h2>Links externos</h2>
      <p>
        Cartões e páginas de evento podem linkar para a fonte original ou para a compra de ingressos em
        sites de terceiros. Uma vez que você sai do CULT, a política de privacidade desse terceiro passa a
        valer.
      </p>

      <p className={styles.note}>
        Este texto descreve o funcionamento atual do produto durante o beta e deve passar por revisão
        formal antes de qualquer operação comercialmente relevante.
      </p>
    </div>
  );
}
