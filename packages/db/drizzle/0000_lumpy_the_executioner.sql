CREATE TYPE "public"."place_level" AS ENUM('continent', 'country', 'region', 'city');--> statement-breakpoint
CREATE TYPE "public"."tag_status" AS ENUM('pending', 'accepted', 'declined');--> statement-breakpoint
CREATE TYPE "public"."visit_purpose" AS ENUM('lived', 'work', 'leisure', 'transit', 'layover');--> statement-breakpoint
CREATE TABLE "follows" (
	"follower_id" text NOT NULL,
	"following_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_following_id_pk" PRIMARY KEY("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "photos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "photos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"visit_id" integer NOT NULL,
	"r2_key" text NOT NULL,
	"width" integer,
	"height" integer,
	"taken_at" timestamp with time zone,
	"exif_lat" double precision,
	"exif_lng" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "places_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"level" "place_level" NOT NULL,
	"parent_id" integer,
	"iso2" text,
	"iso3" text,
	"name" text NOT NULL,
	"display_type" text,
	"lat" double precision,
	"lng" double precision,
	"bbox" jsonb,
	"is_un_member" boolean DEFAULT true NOT NULL,
	"is_user_generated" boolean DEFAULT false NOT NULL,
	"population" integer,
	"country_code" text,
	"admin1_code" text,
	"slug" text NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', "name")) STORED
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trips_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"cover_photo_id" integer,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_place_stats" (
	"user_id" text NOT NULL,
	"place_id" integer NOT NULL,
	"visit_count" integer DEFAULT 0 NOT NULL,
	"first_visit_at" timestamp with time zone,
	"last_visit_at" timestamp with time zone,
	CONSTRAINT "user_place_stats_user_id_place_id_pk" PRIMARY KEY("user_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_key" text,
	"home_place_id" integer,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "visit_tags" (
	"visit_id" integer NOT NULL,
	"tagged_user_id" text NOT NULL,
	"status" "tag_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visit_tags_visit_id_tagged_user_id_pk" PRIMARY KEY("visit_id","tagged_user_id")
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "visits_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" text NOT NULL,
	"place_id" integer NOT NULL,
	"arrived_at" timestamp with time zone,
	"departed_at" timestamp with time zone,
	"purpose" "visit_purpose" DEFAULT 'leisure' NOT NULL,
	"note" text,
	"is_private" boolean DEFAULT false NOT NULL,
	"trip_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photos" ADD CONSTRAINT "photos_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_parent_id_places_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_place_stats" ADD CONSTRAINT "user_place_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_place_stats" ADD CONSTRAINT "user_place_stats_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_home_place_id_places_id_fk" FOREIGN KEY ("home_place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_tags" ADD CONSTRAINT "visit_tags_visit_id_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."visits"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visit_tags" ADD CONSTRAINT "visit_tags_tagged_user_id_users_id_fk" FOREIGN KEY ("tagged_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "follows_following_idx" ON "follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "photos_visit_idx" ON "photos" USING btree ("visit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "places_slug_idx" ON "places" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "places_parent_idx" ON "places" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "places_level_idx" ON "places" USING btree ("level");--> statement-breakpoint
CREATE INDEX "places_iso2_idx" ON "places" USING btree ("iso2");--> statement-breakpoint
CREATE INDEX "places_admin1_idx" ON "places" USING btree ("country_code","admin1_code");--> statement-breakpoint
CREATE INDEX "places_search_idx" ON "places" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "ups_user_idx" ON "user_place_stats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "visit_tags_user_idx" ON "visit_tags" USING btree ("tagged_user_id");--> statement-breakpoint
CREATE INDEX "visits_user_idx" ON "visits" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "visits_place_idx" ON "visits" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "visits_user_place_idx" ON "visits" USING btree ("user_id","place_id");