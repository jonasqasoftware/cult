import { loadAppEnv, loadDotEnvIfPresent } from "@cult/config";
import { computeProductSummary, createDatabaseConnection } from "@cult/database";

// M10 section 30 — real counts, no invented significance. Ratios are informal signals for a
// small beta (a handful of users), not a statistically meaningful conversion rate.
async function main(): Promise<void> {
  loadDotEnvIfPresent();
  const env = loadAppEnv();
  const connection = createDatabaseConnection({ connectionString: env.databaseUrl });

  try {
    const summary = await computeProductSummary(connection.db);
    console.log(`page views: ${summary.counts.page_view}`);
    console.log(`event views: ${summary.counts.event_view}`);
    console.log(`searches: ${summary.counts.search}`);
    console.log(`filter uses: ${summary.counts.filter_used}`);
    console.log(`nearby uses: ${summary.counts.nearby_used}`);
    console.log(`map opens: ${summary.counts.map_opened}`);
    console.log(`shares: ${summary.counts.share}`);
    console.log(`ticket clicks: ${summary.counts.ticket_click}`);
    console.log(`maps clicks: ${summary.counts.maps_click}`);
    console.log("");
    console.log(
      `event_view / page_view: ${
        summary.eventViewPerPageView !== null ? summary.eventViewPerPageView.toFixed(3) : "n/a (no page views yet)"
      }`,
    );
    console.log(
      `intent (ticket_click + maps_click) / event_view: ${
        summary.intentPerEventView !== null ? summary.intentPerEventView.toFixed(3) : "n/a (no event views yet)"
      }`,
    );
    console.log("");
    console.log("Note: these ratios are informal signals for a small beta, not statistically significant.");
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error("[worker] product summary failed:", error);
  process.exit(1);
});
