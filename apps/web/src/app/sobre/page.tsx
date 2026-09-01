import type { Metadata } from "next";
import styles from "../legal-page.module.css";

export const metadata: Metadata = {
  title: "Sobre",
  description: "O que é o CULT e de onde vêm as informações.",
};

// M10 section 23 — no claim of official partnership with any source, no use of a source's
// branding/logo.
export default function AboutPage() {
  return (
    <div className={styles.wrap}>
      <h1 className={styles.heading}>Sobre o CULT</h1>

      <p>CULT reúne e organiza informações culturais para facilitar a descoberta de eventos em Porto Alegre.</p>

      <h2>De onde vêm os eventos</h2>
      <p>
        Os eventos exibidos no CULT vêm de múltiplas fontes públicas ou autorizadas, cada uma com seus
        próprios critérios de publicação. Cada evento traz um link para a fonte original — ingressos,
        detalhes completos e alterações de última hora são responsabilidade de cada fonte, não do CULT.
      </p>
      <p>O CULT não é parceiro oficial de nenhuma das fontes que agrega, e não utiliza suas marcas ou logotipos.</p>

      <h2>Eventos possivelmente duplicados</h2>
      <p>
        Quando o mesmo evento é publicado por mais de uma fonte, o CULT tenta identificar isso
        automaticamente. Em casos de alta confiança, apenas uma versão é exibida. Em casos ambíguos, ambas
        as versões continuam visíveis até uma revisão manual — preferimos mostrar uma duplicata ocasional a
        esconder um evento real por engano.
      </p>

      <h2>O que o CULT não faz (ainda)</h2>
      <ul>
        <li>Não vende ingressos nem processa pagamentos.</li>
        <li>Não exige cadastro para descobrir eventos.</li>
        <li>Não recomenda eventos com base em perfil pessoal ou inteligência artificial.</li>
      </ul>

      <p>
        Veja também nossa página de <a href="/privacidade">Privacidade</a>.
      </p>
    </div>
  );
}
