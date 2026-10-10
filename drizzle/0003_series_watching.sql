ALTER TYPE "public"."title_action" ADD VALUE 'finished';--> statement-breakpoint
ALTER TYPE "public"."title_action" ADD VALUE 'dropped';--> statement-breakpoint
ALTER TABLE "title_states" ADD COLUMN "watching_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "title_states" ADD COLUMN "checked_in_at" timestamp with time zone;