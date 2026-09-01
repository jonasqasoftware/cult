-- M7: Discovery API. Hand-written (drizzle-kit --custom scaffold) rather than diffed from
-- schema.ts: a PostGIS generated column and trigram-opclass GIN indexes aren't expressible
-- through Drizzle's declarative pg-core schema builder in this version, so schema.ts is
-- intentionally NOT updated to declare `venues.location` or these indexes — see
-- packages/database/README (Discovery section) for that documented gap.

-- Public discovery defaults to status='scheduled' (section 18) — every list query filters
-- on this column.
CREATE INDEX IF NOT EXISTS "events_status_idx" ON "events" ("status");--> statement-breakpoint

-- Text search (q): pg_trgm was already enabled by ADR-0005 / docker/postgres/initdb — reused
-- here rather than adding a new extension. GIN + gin_trgm_ops lets `similarity()` and `ILIKE
-- '%term%'` both use the index instead of a sequential scan.
CREATE INDEX IF NOT EXISTS "events_title_trgm_idx" ON "events" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venues_name_trgm_idx" ON "venues" USING gin ("name" gin_trgm_ops);--> statement-breakpoint

-- Temporal filters (today/tomorrow/weekend/this_week/this_month/custom range) join through
-- event_occurrences for every discovery query.
CREATE INDEX IF NOT EXISTS "event_occurrences_starts_at_idx" ON "event_occurrences" ("starts_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_occurrences_date_range_idx" ON "event_occurrences" ("start_date", "end_date");--> statement-breakpoint

-- Nearby (section 37): venues currently only has separate latitude/longitude reals, not a
-- PostGIS geometry/geography column, so ST_DWithin has nothing to index against. A STORED
-- generated column is a small, explicit, low-risk addition — it can never drift out of sync
-- with latitude/longitude (there is no application-side write path to keep in sync), and is
-- simply NULL wherever coordinates are missing, so an event without coordinates naturally
-- never matches `nearby` (section 20) with no special-casing anywhere else.
ALTER TABLE "venues" ADD COLUMN IF NOT EXISTS "location" geography(Point, 4326)
  GENERATED ALWAYS AS (
    CASE
      WHEN "latitude" IS NOT NULL AND "longitude" IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint("longitude", "latitude"), 4326)::geography
      ELSE NULL
    END
  ) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "venues_location_gix" ON "venues" USING GIST ("location");
