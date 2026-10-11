CREATE TABLE "book_signals" (
	"isbn13" text PRIMARY KEY NOT NULL,
	"work_id" integer,
	"title" text NOT NULL,
	"author" text NOT NULL,
	"weeks_on_list" integer DEFAULT 0 NOT NULL,
	"best_rank" integer NOT NULL,
	"lists" text[] DEFAULT '{}'::text[] NOT NULL,
	"last_seen" text NOT NULL,
	"match_tried" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nyt_sync" (
	"published_date" text PRIMARY KEY NOT NULL,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "book_signals_work_idx" ON "book_signals" USING btree ("work_id");