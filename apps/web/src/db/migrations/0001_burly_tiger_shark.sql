CREATE TABLE "app_setting" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voyage_id" text NOT NULL,
	"station_id" text NOT NULL,
	"title" text NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"shown" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"prompt" text NOT NULL,
	"html" text NOT NULL,
	"model" text,
	"escalated" boolean DEFAULT false NOT NULL,
	CONSTRAINT "artifact_version_unique" UNIQUE("artifact_id","version")
);
--> statement-breakpoint
CREATE TABLE "logbuch_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"voyage_id" text NOT NULL,
	"station_id" text NOT NULL,
	"title" text NOT NULL,
	"detail" text,
	"why" text,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "station_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voyage_id" text NOT NULL,
	"station_id" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"score" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "station_progress_unique" UNIQUE("voyage_id","station_id")
);
--> statement-breakpoint
CREATE TABLE "transcript" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"voyage_id" text NOT NULL,
	"station_id" text NOT NULL,
	"station_type" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"lane" text,
	"served_by" text,
	"escalated" boolean DEFAULT false NOT NULL,
	"escalation_reason" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_day" (
	"day" text PRIMARY KEY NOT NULL,
	"active_minutes" integer DEFAULT 0 NOT NULL,
	"session_minutes" integer DEFAULT 0 NOT NULL,
	"session_started_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"calls" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifact_version" ADD CONSTRAINT "artifact_version_artifact_id_artifact_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "artifact_created_idx" ON "artifact" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "logbuch_at_idx" ON "logbuch_entry" USING btree ("at");--> statement-breakpoint
CREATE INDEX "logbuch_kind_idx" ON "logbuch_entry" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "transcript_at_idx" ON "transcript" USING btree ("at");--> statement-breakpoint
CREATE INDEX "transcript_station_idx" ON "transcript" USING btree ("voyage_id","station_id");