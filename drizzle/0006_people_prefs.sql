CREATE TYPE "public"."person_pref" AS ENUM('follow', 'avoid', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."person_source" AS ENUM('tmdb', 'openlibrary');--> statement-breakpoint
CREATE TABLE "people_prefs" (
	"user_id" text NOT NULL,
	"source" "person_source" NOT NULL,
	"person_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"kind" "person_pref" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_prefs_user_id_source_person_id_pk" PRIMARY KEY("user_id","source","person_id")
);
--> statement-breakpoint
ALTER TABLE "people_prefs" ADD CONSTRAINT "people_prefs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;