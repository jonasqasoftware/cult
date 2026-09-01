import Link from "next/link";
import type { DiscoveryFilters, Period } from "../lib/api/types";
import { buildDiscoveryHref, omitFilters } from "../lib/url/discovery-query";
import styles from "./FilterChips.module.css";

const PERIOD_LABELS: Record<Period, string> = {
  today: "Hoje",
  tomorrow: "Amanhã",
  weekend: "Fim de semana",
  this_week: "Esta semana",
  this_month: "Este mês",
};

const PERIOD_SHORTCUTS: readonly Period[] = ["today", "tomorrow", "weekend"];

// M8 section 11 — "Agora" is deliberately absent: a date-only occurrence never means
// "happening all day" (ADR-0014), so the backend has no honest way to answer "what's
// happening right now," and M7 never implemented that semantic. No inactive/fake button here.
export function PeriodShortcuts({ filters }: { filters: DiscoveryFilters }) {
  return (
    <ul className={styles.list} aria-label="Atalhos de período">
      {PERIOD_SHORTCUTS.map((period) => {
        const active = filters.period === period;
        const cleared = omitFilters(filters, ["period", "start", "end"]);
        const nextFilters: DiscoveryFilters = active ? cleared : { ...cleared, period };
        return (
          <li key={period}>
            <Link
              href={buildDiscoveryHref(nextFilters, { includeCursor: false })}
              className={styles.chip}
              aria-pressed={active}
              data-active={active || undefined}
            >
              {PERIOD_LABELS[period]}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
