import type { Category, DiscoveryFilters } from "../lib/api/types";
import { CategoryChips } from "./CategoryChips";
import { FreeShortcut } from "./FreeShortcut";
import { NearbyButton } from "./NearbyButton";
import { PeriodShortcuts } from "./PeriodShortcuts";
import styles from "./FilterBar.module.css";

export function FilterBar({ filters, categories }: { filters: DiscoveryFilters; categories: readonly Category[] }) {
  return (
    <div className={styles.bar}>
      <div className={styles.shortcuts}>
        <PeriodShortcuts filters={filters} />
        <FreeShortcut filters={filters} />
        <NearbyButton filters={filters} />
      </div>
      <CategoryChips categories={categories} filters={filters} />
    </div>
  );
}
