import type { DiscoveryFilters } from "../lib/api/types";
import styles from "./SearchForm.module.css";

// Plain GET form — works with zero client JS. Hidden inputs carry the filters already active
// (period/category/free/geo) so submitting a new search term doesn't silently drop them.
// Cursor is deliberately NOT carried over: a new search always starts from page one.
export function SearchForm({ filters }: { filters: DiscoveryFilters }) {
  return (
    <form action="/" method="get" role="search" className={styles.form}>
      <label htmlFor="q" className="visually-hidden">
        Buscar eventos, artistas ou lugares
      </label>
      <input
        id="q"
        name="q"
        type="search"
        placeholder="Buscar eventos, artistas ou lugares"
        defaultValue={filters.q ?? ""}
        className={styles.input}
      />
      <button type="submit" className={styles.submit}>
        Buscar
      </button>

      {filters.period ? <input type="hidden" name="period" value={filters.period} /> : null}
      {filters.category ? <input type="hidden" name="category" value={filters.category} /> : null}
      {filters.free !== undefined ? <input type="hidden" name="free" value={String(filters.free)} /> : null}
      {filters.lat !== undefined ? <input type="hidden" name="lat" value={filters.lat} /> : null}
      {filters.lng !== undefined ? <input type="hidden" name="lng" value={filters.lng} /> : null}
      {filters.radius !== undefined ? <input type="hidden" name="radius" value={filters.radius} /> : null}
    </form>
  );
}
