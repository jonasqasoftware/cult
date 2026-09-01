import type { Metadata } from "next";
import { discoverEvents, listCategories } from "../lib/api/client";
import { buildCategoryLabelMap } from "../lib/format/category";
import { buildDiscoveryHref, searchParamsToFilters } from "../lib/url/discovery-query";
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

  return (
    <div className={styles.page}>
      <Hero filters={filters} />
      <FilterBar filters={filters} categories={categories} />

      {failed ? (
        <ErrorState retryHref={buildDiscoveryHref(filters)} />
      ) : events && events.data.length === 0 ? (
        <EmptyState hasFilters={hasActiveFilters} />
      ) : events ? (
        <ResultsView
          initialEvents={events.data}
          initialNextCursor={events.pagination.next_cursor}
          filters={filters}
          categoryLabelsById={categoryLabelsById}
        />
      ) : null}
    </div>
  );
}
