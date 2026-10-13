CREATE TABLE "adaptations" (
	"book_id" integer NOT NULL,
	"media" "media_type" NOT NULL,
	"screen_id" integer NOT NULL,
	"via" text NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "adaptations_book_id_media_screen_id_pk" PRIMARY KEY("book_id","media","screen_id")
);
--> statement-breakpoint
CREATE INDEX "adaptations_screen_idx" ON "adaptations" USING btree ("media","screen_id");--> statement-breakpoint
CREATE INDEX "adaptations_unchecked_idx" ON "adaptations" USING btree ("book_id") WHERE not "adaptations"."checked";