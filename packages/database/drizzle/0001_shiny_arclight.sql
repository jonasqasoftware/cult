-- M4 (ADR-0014): EventOccurrence becomes a discriminated union (timed | date-only).
-- Hand-edited from the drizzle-kit-generated scaffold: temporal_kind is backfilled to
-- 'timed' for every existing row (all M2/M3 data is timed) BEFORE the NOT NULL constraint
-- is applied, since a bare "ADD COLUMN ... NOT NULL" with no default fails on a non-empty
-- table.
ALTER TABLE "event_occurrences" ALTER COLUMN "starts_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD COLUMN "temporal_kind" text;--> statement-breakpoint
UPDATE "event_occurrences" SET "temporal_kind" = 'timed' WHERE "temporal_kind" IS NULL;--> statement-breakpoint
ALTER TABLE "event_occurrences" ALTER COLUMN "temporal_kind" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD COLUMN "start_date" date;--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD COLUMN "end_date" date;--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_temporal_kind_shape" CHECK ((
        ("event_occurrences"."temporal_kind" = 'timed' AND "event_occurrences"."starts_at" IS NOT NULL AND "event_occurrences"."start_date" IS NULL AND "event_occurrences"."end_date" IS NULL)
        OR
        ("event_occurrences"."temporal_kind" = 'date' AND "event_occurrences"."start_date" IS NOT NULL AND "event_occurrences"."starts_at" IS NULL AND "event_occurrences"."ends_at" IS NULL)
      ));--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_ends_at_after_starts_at" CHECK ("event_occurrences"."ends_at" IS NULL OR "event_occurrences"."ends_at" >= "event_occurrences"."starts_at");--> statement-breakpoint
ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_end_date_after_start_date" CHECK ("event_occurrences"."end_date" IS NULL OR "event_occurrences"."end_date" >= "event_occurrences"."start_date");
