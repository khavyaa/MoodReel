CREATE TYPE "public"."media_type" AS ENUM('movie', 'series', 'book');--> statement-breakpoint
CREATE TYPE "public"."pick_status" AS ENUM('dealing', 'finale', 'picked', 'empty', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."title_action" AS ENUM('saved', 'skipped', 'seen', 'disliked', 'picked', 'unsaved');--> statement-breakpoint
CREATE TYPE "public"."title_source" AS ENUM('tmdb', 'openlibrary');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pick_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"media" "media_type" NOT NULL,
	"mood" text NOT NULL,
	"energy" smallint NOT NULL,
	"time" smallint NOT NULL,
	"status" "pick_status" DEFAULT 'dealing' NOT NULL,
	"deck" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"shortlist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pick" jsonb,
	"why" text,
	"why_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"region" text DEFAULT 'IN' NOT NULL,
	"services" text[] DEFAULT array['Apple TV','Netflix','Prime Video','JioHotstar']::text[] NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "title_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"media" "media_type" NOT NULL,
	"source" "title_source" NOT NULL,
	"external_id" text NOT NULL,
	"action" "title_action" NOT NULL,
	"pick_session_id" uuid,
	"mood" text,
	"language" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "title_states" (
	"user_id" text NOT NULL,
	"media" "media_type" NOT NULL,
	"source" "title_source" NOT NULL,
	"external_id" text NOT NULL,
	"saved" boolean DEFAULT false NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"skipped" boolean DEFAULT false NOT NULL,
	"disliked" boolean DEFAULT false NOT NULL,
	"picked_at" timestamp with time zone,
	"rating" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "title_states_user_id_media_source_external_id_pk" PRIMARY KEY("user_id","media","source","external_id"),
	CONSTRAINT "title_states_rating_range" CHECK ("title_states"."rating" is null or "title_states"."rating" between 1 and 10)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pick_sessions" ADD CONSTRAINT "pick_sessions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_actions" ADD CONSTRAINT "title_actions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_actions" ADD CONSTRAINT "title_actions_pick_session_id_pick_sessions_id_fk" FOREIGN KEY ("pick_session_id") REFERENCES "public"."pick_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "title_states" ADD CONSTRAINT "title_states_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "pick_sessions_user_created_idx" ON "pick_sessions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "title_actions_user_created_idx" ON "title_actions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "title_actions_user_title_idx" ON "title_actions" USING btree ("user_id","media","source","external_id");--> statement-breakpoint
CREATE INDEX "title_states_saved_idx" ON "title_states" USING btree ("user_id","media") WHERE "title_states"."saved";