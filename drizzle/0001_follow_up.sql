ALTER TABLE "pick_sessions" ADD COLUMN "origin" text DEFAULT 'deck' NOT NULL;--> statement-breakpoint
ALTER TABLE "pick_sessions" ADD COLUMN "follow_up" text;--> statement-breakpoint
ALTER TABLE "pick_sessions" ADD COLUMN "followed_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "preferences" DROP COLUMN "services";