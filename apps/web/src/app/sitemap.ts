import type { MetadataRoute } from "next";
import { discoverEvents } from "../lib/api/client";

function getSiteUrl(): string {
  return process.env["NEXT_PUBLIC_SITE_URL"] ?? "http://localhost:3000";
}

// M10 section 20 — a page cap, not a benchmark or an SLA: this is a pragmatic ceiling
// against an unbounded loop, not a claim about how many events the product should ever have.
const MAX_PAGES = 50;

// Only discovery-visible events (status: "scheduled" is discoverEvents' own default —
// cancelled/postponed/completed/rescheduled are never listed here) — and discoverEvents
// already applies M9's dedup presentation suppression, so a suppressed duplicate's slug
// never appears. Never includes raw/internal data (M10 section 20 explicitly warns against
// that) — only the same public slug the discovery API already exposes.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const entries: MetadataRoute.Sitemap = [{ url: siteUrl, changeFrequency: "hourly", priority: 1 }];

  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let result;
    try {
      result = await discoverEvents(cursor ? { cursor } : {});
    } catch {
      // Best-effort: a sitemap failing to fully build must never break the site itself
      // (M10 section 29's "analytics never blocks product" principle applies equally here).
      break;
    }

    for (const event of result.data) {
      entries.push({ url: `${siteUrl}/eventos/${event.slug}`, changeFrequency: "daily", priority: 0.7 });
    }

    if (!result.pagination.next_cursor) break;
    cursor = result.pagination.next_cursor;
  }

  return entries;
}
