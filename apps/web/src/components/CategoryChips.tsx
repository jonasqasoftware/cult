import Link from "next/link";
import type { Category, DiscoveryFilters } from "../lib/api/types";
import { presentCategoryLabel } from "../lib/format/category";
import { buildDiscoveryHref, omitFilters } from "../lib/url/discovery-query";
import styles from "./FilterChips.module.css";

export function CategoryChips({ categories, filters }: { categories: readonly Category[]; filters: DiscoveryFilters }) {
  if (categories.length === 0) return null;

  return (
    <nav aria-label="Categorias">
      <h2 className="visually-hidden">Categorias</h2>
      <ul className={`${styles.list} ${styles.scrollRow}`}>
        {categories.map((category) => {
          const active = filters.category === category.id;
          const nextFilters: DiscoveryFilters = active
            ? omitFilters(filters, ["category"])
            : { ...filters, category: category.id };
          return (
            <li key={category.id}>
              <Link
                href={buildDiscoveryHref(nextFilters, { includeCursor: false })}
                className={styles.chip}
                aria-pressed={active}
                data-active={active || undefined}
              >
                {presentCategoryLabel(category)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
