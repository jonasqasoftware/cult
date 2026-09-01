import Link from "next/link";
import type { DiscoveryFilters } from "../lib/api/types";
import { buildDiscoveryHref, omitFilters } from "../lib/url/discovery-query";
import styles from "./FilterChips.module.css";

export function FreeShortcut({ filters }: { filters: DiscoveryFilters }) {
  const active = filters.free === true;
  const nextFilters: DiscoveryFilters = active ? omitFilters(filters, ["free"]) : { ...filters, free: true };

  return (
    <Link
      href={buildDiscoveryHref(nextFilters, { includeCursor: false })}
      className={styles.chip}
      aria-pressed={active}
      data-active={active || undefined}
    >
      Grátis
    </Link>
  );
}
