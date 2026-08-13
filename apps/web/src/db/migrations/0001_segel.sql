CREATE TABLE "station_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner" text DEFAULT 'segler' NOT NULL,
	"voyage_slug" text NOT NULL,
	"station_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"served_by" text,
	"blocked" boolean DEFAULT false NOT NULL,
	"block_reason" text
);
--> statement-breakpoint
CREATE TABLE "logbuch_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner" text DEFAULT 'segler' NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"voyage_slug" text NOT NULL,
	"station_id" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"quote" text,
	"score" integer DEFAULT 0 NOT NULL,
	"run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner" text DEFAULT 'segler' NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"prompt" text NOT NULL,
	"html" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"escalated" boolean DEFAULT false NOT NULL,
	"served_by" text,
	CONSTRAINT "artifact_version_unique" UNIQUE("artifact_id","version")
);
--> statement-breakpoint
CREATE TABLE "escalation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"station" text NOT NULL,
	"from_model" text NOT NULL,
	"to_model" text NOT NULL,
	"reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "voyage_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner" text DEFAULT 'segler' NOT NULL,
	"voyage_slug" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"debrief" text,
	CONSTRAINT "voyage_progress_unique" UNIQUE("learner","voyage_slug")
);
--> statement-breakpoint
CREATE TABLE "session_window" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"learner" text DEFAULT 'segler' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message" ADD CONSTRAINT "message_run_id_station_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."station_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logbuch_entry" ADD CONSTRAINT "logbuch_entry_run_id_station_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."station_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_version" ADD CONSTRAINT "artifact_version_artifact_id_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "station_run_learner_started_idx" ON "station_run" USING btree ("learner","started_at");--> statement-breakpoint
CREATE INDEX "station_run_voyage_idx" ON "station_run" USING btree ("voyage_slug","station_id");--> statement-breakpoint
CREATE INDEX "message_run_at_idx" ON "message" USING btree ("run_id","at");--> statement-breakpoint
CREATE INDEX "logbuch_learner_at_idx" ON "logbuch_entry" USING btree ("learner","at");--> statement-breakpoint
CREATE INDEX "artifact_learner_updated_idx" ON "artifact" USING btree ("learner","updated_at");--> statement-breakpoint
CREATE INDEX "escalation_at_idx" ON "escalation" USING btree ("at");--> statement-breakpoint
CREATE INDEX "session_window_learner_started_idx" ON "session_window" USING btree ("learner","started_at");
