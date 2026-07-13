import { sql, type SQL } from "drizzle-orm";
import {
  boolean,
  customType,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ─── custom types ────────────────────────────────────────────────────────────
// Postgres tsvector is not a first-class Drizzle type; define it so we can build
// a STORED generated column + GIN index for full-text place search.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// ─── enums ─────────────────────────────────────────────────────────────────
export const placeLevel = pgEnum("place_level", [
  "continent",
  "country",
  "region",
  "city",
]);

export const visitPurpose = pgEnum("visit_purpose", [
  "lived",
  "work",
  "leisure",
  "transit",
  "layover",
]);

export const tagStatus = pgEnum("tag_status", [
  "pending",
  "accepted",
  "declined",
]);

// ─── places ──────────────────────────────────────────────────────────────────
// Seeded, ~59k rows, read-mostly. Four levels in one self-referencing table.
// NEVER store a "visited" flag here — visited state is derived from `visits`.
export const places = pgTable(
  "places",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    level: placeLevel("level").notNull(),
    parentId: integer("parent_id").references((): AnyPgColumn => places.id),

    // country-level only
    iso2: text("iso2"),
    iso3: text("iso3"),

    name: text("name").notNull(),
    // human label for the admin-1 level: "State" | "Province" | "Prefecture" | ...
    displayType: text("display_type"),

    lat: doublePrecision("lat"),
    lng: doublePrecision("lng"),
    // [minLng, minLat, maxLng, maxLat]
    bbox: jsonb("bbox").$type<[number, number, number, number]>(),

    isUnMember: boolean("is_un_member").notNull().default(true),
    isUserGenerated: boolean("is_user_generated").notNull().default(false),
    population: integer("population"),

    // GeoNames provenance — lets cities join to their region by construction.
    countryCode: text("country_code"), // ISO2 of owning country
    admin1Code: text("admin1_code"), // GeoNames admin1 code (region level)

    slug: text("slug").notNull(),

    // STORED generated tsvector. Column name referenced as a literal to avoid a
    // self-reference cycle at table-build time.
    searchVector: tsvector("search_vector").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('simple', "name")`,
    ),
  },
  (t) => [
    uniqueIndex("places_slug_idx").on(t.slug),
    index("places_parent_idx").on(t.parentId),
    index("places_level_idx").on(t.level),
    index("places_iso2_idx").on(t.iso2),
    index("places_admin1_idx").on(t.countryCode, t.admin1Code),
    index("places_search_idx").using("gin", t.searchVector),
  ],
);

// ─── users ─────────────────────────────────────────────────────────────────
// `id` is a plain string. Runs on the 'dev-user' seed row until the auth phase,
// when it is bound to Clerk user IDs — a data migration, not a schema change.
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  displayName: text("display_name").notNull(),
  avatarKey: text("avatar_key"),
  homePlaceId: integer("home_place_id").references(() => places.id),
  isPrivate: boolean("is_private").notNull().default(false),
  // user-customizable passport-map palette (see @travld/ui MapTheme); null = default
  mapTheme: jsonb("map_theme").$type<{
    visited: string;
    land: string;
    water: string;
    partial: string;
  }>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── trips ─────────────────────────────────────────────────────────────────
export const trips = pgTable("trips", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  coverPhotoId: integer("cover_photo_id"),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── visits — the event log, the heart ───────────────────────────────────────
// Every stat in the app is a projection over these rows.
export const visits = pgTable(
  "visits",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: integer("place_id")
      .notNull()
      .references(() => places.id), // usually a city, can be any level
    arrivedAt: timestamp("arrived_at", { withTimezone: true }), // nullable: "been, don't remember when"
    departedAt: timestamp("departed_at", { withTimezone: true }),
    purpose: visitPurpose("purpose").notNull().default("leisure"),
    note: text("note"),
    isPrivate: boolean("is_private").notNull().default(false),
    tripId: integer("trip_id").references(() => trips.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("visits_user_idx").on(t.userId),
    index("visits_place_idx").on(t.placeId),
    index("visits_user_place_idx").on(t.userId, t.placeId),
  ],
);

// ─── userPlaceStats — derived cache, rebuilt on visit write (upsert, not cron) ─
export const userPlaceStats = pgTable(
  "user_place_stats",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    placeId: integer("place_id")
      .notNull()
      .references(() => places.id),
    visitCount: integer("visit_count").notNull().default(0),
    firstVisitAt: timestamp("first_visit_at", { withTimezone: true }),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.placeId] }),
    index("ups_user_idx").on(t.userId),
  ],
);

// ─── tagging — the social hook ───────────────────────────────────────────────
export const visitTags = pgTable(
  "visit_tags",
  {
    visitId: integer("visit_id")
      .notNull()
      .references(() => visits.id, { onDelete: "cascade" }),
    taggedUserId: text("tagged_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: tagStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.visitId, t.taggedUserId] }),
    index("visit_tags_user_idx").on(t.taggedUserId),
  ],
);

// ─── photos ──────────────────────────────────────────────────────────────────
export const photos = pgTable(
  "photos",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    visitId: integer("visit_id")
      .notNull()
      .references(() => visits.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(),
    width: integer("width"),
    height: integer("height"),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    exifLat: doublePrecision("exif_lat"),
    exifLng: doublePrecision("exif_lng"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("photos_visit_idx").on(t.visitId)],
);

// ─── follows — asymmetric, Twitter-style ─────────────────────────────────────
export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followingId] }),
    index("follows_following_idx").on(t.followingId),
  ],
);

// ─── inferred types ──────────────────────────────────────────────────────────
export type Place = typeof places.$inferSelect;
export type NewPlace = typeof places.$inferInsert;
export type Visit = typeof visits.$inferSelect;
export type NewVisit = typeof visits.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserPlaceStat = typeof userPlaceStats.$inferSelect;
