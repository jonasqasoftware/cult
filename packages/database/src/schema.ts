import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// M2 vertical-slice schema. Only what the Ticketmaster slice needs:
// sources, raw_events, venues, events, event_occurrences, event_sources.
// No dedup_candidates, users, favorites, categories, or M:N organizer/performer tables yet.

export const sources = pgTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  enabled: boolean("enabled").notNull(),
  authorityScore: real("authority_score").notNull(),
  commercialUse: text("commercial_use").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// M7 (migration 0002): the table also has a generated `location geography(Point, 4326)`
// column (STORED, derived from latitude/longitude) plus a GIST index on it, and GIN trigram
// indexes on `name` (here) and `events.title` — all added by hand-written SQL rather than
// declared here, because Drizzle's pg-core schema builder in this version has no first-class
// way to express a PostGIS-generated column or a trigram opclass index. See
// packages/database/drizzle/0002_discovery_indexes.sql and the Discovery section of this
// package's README. A future drizzle-kit generate against this file will not know about
// `location` or these indexes — that drift is intentional and documented, not accidental.
export const venues = pgTable("venues", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  neighborhood: text("neighborhood"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
});

export const rawEvents = pgTable(
  "raw_events",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    externalId: text("external_id"),
    sourceUrl: text("source_url").notNull(),
    payloadJson: jsonb("payload_json").notNull().$type<unknown>(),
    contentHash: text("content_hash").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    // pending -> normalized | failed. Never deleted on failure — ADR-0006 / ADR-0013.
    processingStatus: text("processing_status").notNull().default("pending"),
    processingError: text("processing_error"),
    schemaVersion: integer("schema_version").notNull(),
    // NULL = no retention limit configured yet. Must never be treated as "forever" — ADR-0013.
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("raw_events_source_external_id_unique")
      .on(table.sourceId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
  ],
);

// M7 (migration 0002): also has a plain btree index on `status` and a GIN trigram index on
// `title` (hand-written SQL — see the `venues` comment above for why).
export const events = pgTable("events", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  // No categories table in M2 — free-text id/slug derived from the provider's classification.
  categoryId: text("category_id"),
  subcategories: jsonb("subcategories").notNull().$type<string[]>(),
  status: text("status").notNull(),
  venueId: text("venue_id").references(() => venues.id),
  // Organizer/performers stored inline as JSON — no dedicated M:N tables yet (avoid overmodeling).
  organizer: jsonb("organizer").$type<{
    id: string;
    name: string;
    websiteUrl?: string;
  }>(),
  performers: jsonb("performers")
    .notNull()
    .$type<{ id: string; name: string }[]>(),
  price: jsonb("price").$type<{
    free: boolean;
    min?: number;
    max?: number;
    currency: "BRL";
  }>(),
  ageRating: text("age_rating"),
  accessibility: jsonb("accessibility").notNull().$type<string[]>(),
  imageUrl: text("image_url"),
  ticketUrl: text("ticket_url"),
  canonicalUrl: text("canonical_url"),
  // M2 placeholder values only — see @cult/canonical-events provisional-scores.ts.
  qualityScore: real("quality_score").notNull(),
  rankingScore: real("ranking_score").notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

// M4 (ADR-0014): a discriminated union at the domain level (TimedEventOccurrence |
// DateOnlyEventOccurrence). temporal_kind mirrors that discriminant; the CHECK constraints
// below enforce that a row's shape actually matches its declared kind — the database, not
// just the domain factory, refuses a "timed" row with no starts_at or a "date" row with one.
// M7 (migration 0002): also has plain btree indexes on `starts_at` and `(start_date,
// end_date)`, supporting Discovery's temporal filters (hand-written SQL, same reason as above).
export const eventOccurrences = pgTable(
  "event_occurrences",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    temporalKind: text("temporal_kind").notNull(), // 'timed' | 'date'
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    // mode: "string" — a date-only value is never round-tripped through a JS Date/instant.
    startDate: date("start_date", { mode: "string" }),
    endDate: date("end_date", { mode: "string" }),
    timezone: text("timezone").notNull(),
    status: text("status").notNull(),
  },
  (table) => [
    check(
      "event_occurrences_temporal_kind_shape",
      sql`(
        (${table.temporalKind} = 'timed' AND ${table.startsAt} IS NOT NULL AND ${table.startDate} IS NULL AND ${table.endDate} IS NULL)
        OR
        (${table.temporalKind} = 'date' AND ${table.startDate} IS NOT NULL AND ${table.startsAt} IS NULL AND ${table.endsAt} IS NULL)
      )`,
    ),
    check(
      "event_occurrences_ends_at_after_starts_at",
      sql`${table.endsAt} IS NULL OR ${table.endsAt} >= ${table.startsAt}`,
    ),
    check(
      "event_occurrences_end_date_after_start_date",
      sql`${table.endDate} IS NULL OR ${table.endDate} >= ${table.startDate}`,
    ),
  ],
);

export const eventSources = pgTable(
  "event_sources",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id),
    externalId: text("external_id"),
    url: text("url").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
    confidence: real("confidence").notNull(),
  },
  (table) => [primaryKey({ columns: [table.eventId, table.sourceId] })],
);
