CREATE TABLE "list_follows" (
	"user_id" text NOT NULL,
	"list_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_follows_user_id_list_slug_pk" PRIMARY KEY("user_id","list_slug")
);
--> statement-breakpoint
CREATE TABLE "list_items" (
	"list_slug" text NOT NULL,
	"media" "media_type" NOT NULL,
	"external_id" integer NOT NULL,
	"year" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_items_list_slug_media_external_id_pk" PRIMARY KEY("list_slug","media","external_id")
);
--> statement-breakpoint
ALTER TABLE "list_follows" ADD CONSTRAINT "list_follows_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;