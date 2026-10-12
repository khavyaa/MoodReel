CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"report" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "sync_runs_kind_ran_idx" ON "sync_runs" USING btree ("kind","ran_at" DESC NULLS LAST);