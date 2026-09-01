"use client";

import { useState } from "react";
import type { CultEvent, DiscoveryFilters } from "../lib/api/types";
import { buildDiscoveryHref } from "../lib/url/discovery-query";
import { QueryResults, type ResultsViewMode } from "./QueryResults";

export interface ResultsViewProps {
  readonly initialEvents: readonly CultEvent[];
  readonly initialNextCursor: string | null;
  readonly filters: DiscoveryFilters;
  readonly categoryLabelsById: Readonly<Record<string, string>>;
}

// M10.2 Phase C — this component's identity stays stable across a filter-navigation (page.tsx
// no longer keys *it*), so `view` (the user's Lista/Mapa preference) survives a filter change.
// Only QueryResults — the child that actually owns the result set/pagination — remounts, via
// its own filters-derived `key` below. Splitting the two used to be one component with two
// concerns: a `key` that reset stale query results also reset the view toggle as a side
// effect (the original bug fix from apps/web/src/app/page.tsx re-introduced a *different*
// bug — applying a filter while looking at the map silently bounced back to the list).
export function ResultsView({ initialEvents, initialNextCursor, filters, categoryLabelsById }: ResultsViewProps) {
  const [view, setView] = useState<ResultsViewMode>("list");
  const queryKey = buildDiscoveryHref(filters, { includeCursor: false });

  return (
    <QueryResults
      key={queryKey}
      view={view}
      onViewChange={setView}
      initialEvents={initialEvents}
      initialNextCursor={initialNextCursor}
      filters={filters}
      categoryLabelsById={categoryLabelsById}
    />
  );
}
