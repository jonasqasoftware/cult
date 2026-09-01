CREATE TABLE "dedup_candidates" (
	"id" text PRIMARY KEY NOT NULL,
	"left_event_id" text NOT NULL,
	"right_event_id" text NOT NULL,
	"score" real NOT NULL,
	"routing" text NOT NULL,
	"signals_json" jsonb NOT NULL,
	"conflicts_json" jsonb NOT NULL,
	"auto_merge_eligible" boolean NOT NULL,
	"blockers_json" jsonb NOT NULL,
	"status" text NOT NULL,
	"decision_source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"evaluated_at" timestamp with time zone NOT NULL,
	"decided_at" timestamp with time zone,
	CONSTRAINT "dedup_candidates_normalized_pair" CHECK ("dedup_candidates"."left_event_id" < "dedup_candidates"."right_event_id")
);
--> statement-breakpoint
ALTER TABLE "dedup_candidates" ADD CONSTRAINT "dedup_candidates_left_event_id_events_id_fk" FOREIGN KEY ("left_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dedup_candidates" ADD CONSTRAINT "dedup_candidates_right_event_id_events_id_fk" FOREIGN KEY ("right_event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dedup_candidates_pair_unique" ON "dedup_candidates" USING btree ("left_event_id","right_event_id");--> statement-breakpoint
CREATE INDEX "dedup_candidates_status_idx" ON "dedup_candidates" USING btree ("status");