import type { DiscoveryFilters } from "../lib/api/types";
import { SearchForm } from "./SearchForm";
import styles from "./Hero.module.css";

export function Hero({ filters }: { filters: DiscoveryFilters }) {
  return (
    <div className={styles.hero}>
      <h1 className={styles.heading}>
        Descubra o que fazer
        <br />
        em Porto Alegre
      </h1>
      <SearchForm filters={filters} />
    </div>
  );
}
