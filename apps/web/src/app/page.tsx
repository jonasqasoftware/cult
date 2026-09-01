import type { Metadata } from "next";
import { discoverEvents, listCategories } from "../lib/api/client";
import { buildCategoryLabelMap } from "../lib/format/category";
import { buildDiscoveryHref, searchParamsToFilters } from "../lib/url/discovery-query";
import { AnalyticsPageView } from "../components/AnalyticsPageView";
import { EmptyState } from "../components/EmptyState";
import { ErrorState } from "../components/ErrorState";
import { FilterBar } from "../components/FilterBar";
import { Hero } from "../components/Hero";
import { ResultsView } from "../components/ResultsView";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "CULT — Descubra o que fazer em Porto Alegre",
};

// A smaller first page reads better on mobile (less to scroll before "Carregar mais" is even
// visible) and, with the current ~13-event fixture dataset, deterministically exercises
// pagination in E2E without needing to fabricate extra fixtures.
const PAGE_SIZE = 12;

interface HomePageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const resolvedSearchParams = await searchParams;
  const filters = searchParamsToFilters(resolvedSearchParams);

  let categories: Awaited<ReturnType<typeof listCategories>>["data"] = [];
  let events: Awaited<ReturnType<typeof discoverEvents>> | null = null;
  let failed = false;

  try {
    const [categoriesResult, eventsResult] = await Promise.all([
      listCategories(),
      discoverEvents({ ...filters, limit: PAGE_SIZE }),
    ]);
    categories = categoriesResult.data;
    events = eventsResult;
  } catch {
    failed = true;
  }

  const categoryLabelsById = Object.fromEntries(buildCategoryLabelMap(categories));
  const hasActiveFilters = Object.keys(filters).length > 0;

  // Section 25/28 — SearchForm/CategoryChips/FreeShortcut are deliberately plain
  // server-rendered <form>/<Link> elements with no client JS of their own (progressive
  // enhancement, works with JS disabled). Rather than adding onClick handlers that would
  // force them into client components, page_view/search/filter_used are observed here, from
  // the RESULTING page's own filters — an equally accurate signal with zero extra JS on the
  // controls themselves.
  const pageViewMetadata: Record<string, string | boolean> = {};
  if (filters.period) pageViewMetadata["period"] = filters.period;
  if (filters.category) pageViewMetadata["category"] = filters.category;
  if (filters.free !== undefined) pageViewMetadata["free"] = filters.free;

  return (
    <div className={styles.page}>
      <AnalyticsPageView event="page_view" metadata={pageViewMetadata} />
      {filters.q ? <AnalyticsPageView event="search" /> : null}
      {filters.category || filters.free !== undefined ? (
        <AnalyticsPageView event="filter_used" metadata={pageViewMetadata} />
      ) : null}
      <Hero filters={filters} />
      <FilterBar filters={filters} categories={categories} />

      {failed ? (
        <ErrorState retryHref={buildDiscoveryHref(filters)} />
      ) : events && events.data.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters} />
      ) : events ? (
        <ResultsView
          // Forces a remount when the query filters actually change (App Router preserves
          // this Client Component instance across navigations between filter states, so its
          // internal `useState(initialEvents)` would otherwise keep rendering stale results
          // — the new SSR props arrive but are never re-read after the first mount). Cursor
          // is excluded so "Carregar mais" (which only changes cursor) keeps appending to the
          // same mounted instance instead of resetting it.
          key={buildDiscoveryHref(filters, { includeCursor: false })}
          initialEvents={events.data}
          initialNextCursor={events.pagination.next_cursor}
          filters={filters}
          categoryLabelsById={categoryLabelsById}
        />
      ) : null}
    </div>
  );
}
