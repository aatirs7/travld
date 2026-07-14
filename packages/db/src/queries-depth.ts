import { sql } from "drizzle-orm";
import { db } from "./client";
import { createPool } from "./pool";
import { getVisitedCountries, type VisitedSummary } from "./queries";
import { recomputeUserPlaceStats } from "./stats";

// ─── search (tsvector prefix, GIN-backed) ────────────────────────────────────

export interface SearchResult {
  id: number;
  name: string;
  level: "continent" | "country" | "region" | "city";
  displayType: string | null;
  countryName: string | null;
  countryIso2: string | null;
  lat: number | null;
  lng: number | null;
}

/** Build a safe prefix tsquery: last term gets `:*` for typeahead. */
function toPrefixQuery(q: string): string | null {
  const terms = q.toLowerCase().match(/[a-z0-9]+/g);
  if (!terms || terms.length === 0) return null;
  return terms.map((t, i) => (i === terms.length - 1 ? `${t}:*` : t)).join(" & ");
}

export async function searchPlaces(q: string, limit = 20): Promise<SearchResult[]> {
  const tsq = toPrefixQuery(q);
  if (!tsq) return [];
  const rows = await db.execute(sql`
    SELECT p.id, p.name, p.level, p.display_type AS "displayType",
           p.lat, p.lng,
           cc.name AS "countryName", COALESCE(p.country_code, p.iso2) AS "countryIso2"
    FROM places p
    LEFT JOIN places cc
      ON cc.level = 'country' AND cc.iso2 = COALESCE(p.country_code, p.iso2)
    WHERE p.search_vector @@ to_tsquery('simple', ${tsq})
    ORDER BY ts_rank(p.search_vector, to_tsquery('simple', ${tsq})) DESC,
             p.population DESC NULLS LAST
    LIMIT ${limit}
  `);
  return rows.rows as unknown as SearchResult[];
}

// ─── country drill-down ───────────────────────────────────────────────────────

export interface RegionRow {
  id: number;
  name: string;
  displayType: string | null;
  visited: boolean;
}

export interface CountryDetail {
  id: number;
  iso2: string | null;
  name: string;
  displayType: string | null;
  regionTotal: number;
  regionVisited: number;
  regions: RegionRow[];
  visitCount: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
}

export async function getCountryDetail(
  userId: string,
  iso2: string,
): Promise<CountryDetail | null> {
  const countryRows = await db.execute(sql`
    SELECT p.id, p.iso2, p.name, p.display_type AS "displayType",
           COALESCE(s.visit_count, 0) AS "visitCount",
           s.first_visit_at AS "firstVisitAt", s.last_visit_at AS "lastVisitAt"
    FROM places p
    LEFT JOIN user_place_stats s ON s.place_id = p.id AND s.user_id = ${userId}
    WHERE p.level = 'country' AND p.iso2 = ${iso2} LIMIT 1
  `);
  const country = countryRows.rows[0] as any;
  if (!country) return null;

  const regionRows = await db.execute(sql`
    SELECT r.id, r.name, r.display_type AS "displayType",
           (s.place_id IS NOT NULL) AS visited
    FROM places r
    LEFT JOIN user_place_stats s ON s.place_id = r.id AND s.user_id = ${userId}
    WHERE r.level = 'region' AND r.parent_id = ${country.id}
    ORDER BY r.name ASC
  `);
  const regions = (regionRows.rows as any[]).map((r) => ({
    id: Number(r.id),
    name: r.name,
    displayType: r.displayType,
    visited: r.visited === true,
  }));
  return {
    id: Number(country.id),
    iso2: country.iso2,
    name: country.name,
    displayType: country.displayType,
    regionTotal: regions.length,
    regionVisited: regions.filter((r) => r.visited).length,
    regions,
    visitCount: Number(country.visitCount ?? 0),
    firstVisitAt: country.firstVisitAt ? new Date(country.firstVisitAt).toISOString() : null,
    lastVisitAt: country.lastVisitAt ? new Date(country.lastVisitAt).toISOString() : null,
  };
}

/** Cities directly under a place (region or country), largest first, with visited flags. */
export async function getPlaceCities(
  userId: string,
  placeId: number,
  limit = 100,
): Promise<{ id: number; name: string; population: number | null; visited: boolean }[]> {
  const rows = await db.execute(sql`
    SELECT c.id, c.name, c.population,
           (s.place_id IS NOT NULL) AS visited
    FROM places c
    LEFT JOIN user_place_stats s ON s.place_id = c.id AND s.user_id = ${userId}
    WHERE c.level = 'city' AND c.parent_id = ${placeId}
    ORDER BY c.population DESC NULLS LAST
    LIMIT ${limit}
  `);
  return (rows.rows as any[]).map((r) => ({
    id: Number(r.id),
    name: r.name,
    population: r.population != null ? Number(r.population) : null,
    visited: r.visited === true,
  }));
}

/** All cities in a country (by stored country_code), largest first, visited flags. */
export async function getCountryCities(
  userId: string,
  iso2: string,
  limit = 100,
): Promise<{ id: number; name: string; population: number | null; visited: boolean }[]> {
  const rows = await db.execute(sql`
    SELECT c.id, c.name, c.population, (s.place_id IS NOT NULL) AS visited
    FROM places c
    LEFT JOIN user_place_stats s ON s.place_id = c.id AND s.user_id = ${userId}
    WHERE c.level = 'city' AND c.country_code = ${iso2}
    ORDER BY c.population DESC NULLS LAST
    LIMIT ${limit}
  `);
  return (rows.rows as any[]).map((r) => ({
    id: Number(r.id),
    name: r.name,
    population: r.population != null ? Number(r.population) : null,
    visited: r.visited === true,
  }));
}

export interface VisitRow {
  id: number;
  placeName: string;
  placeLevel: "continent" | "country" | "region" | "city";
  purpose: string;
  arrivedAt: string | null;
  note: string | null;
  tripId: number | null;
  tripTitle: string | null;
}

/** The user's visits within a country (any level whose country_code matches, or the country itself). */
export async function getCountryVisits(userId: string, iso2: string): Promise<VisitRow[]> {
  const rows = await db.execute(sql`
    SELECT v.id, p.name AS "placeName", p.level AS "placeLevel",
           v.purpose, v.arrived_at AS "arrivedAt", v.note,
           v.trip_id AS "tripId", tr.title AS "tripTitle"
    FROM visits v
    JOIN places p ON p.id = v.place_id
    LEFT JOIN trips tr ON tr.id = v.trip_id
    WHERE v.user_id = ${userId}
      AND (p.country_code = ${iso2} OR (p.level = 'country' AND p.iso2 = ${iso2}))
    ORDER BY v.created_at DESC
  `);
  return (rows.rows as any[]).map((r) => ({
    id: Number(r.id),
    placeName: r.placeName,
    placeLevel: r.placeLevel,
    purpose: r.purpose,
    arrivedAt: r.arrivedAt ? new Date(r.arrivedAt).toISOString() : null,
    note: r.note ?? null,
    tripId: r.tripId != null ? Number(r.tripId) : null,
    tripTitle: r.tripTitle ?? null,
  }));
}

// ─── region heatmap (admin-1s visited per country) ────────────────────────────

export interface RegionProgress {
  [iso2: string]: { total: number; visited: number };
}

export async function getRegionProgress(userId: string): Promise<RegionProgress> {
  const rows = await db.execute(sql`
    SELECT c.iso2 AS iso2,
           count(r.id)::int AS total,
           count(s.place_id)::int AS visited
    FROM places c
    JOIN places r ON r.parent_id = c.id AND r.level = 'region'
    LEFT JOIN user_place_stats s ON s.place_id = r.id AND s.user_id = ${userId}
    WHERE c.level = 'country' AND c.iso2 IS NOT NULL
    GROUP BY c.iso2
    HAVING count(r.id) > 0
  `);
  const out: RegionProgress = {};
  for (const r of rows.rows as any[]) {
    out[r.iso2] = { total: Number(r.total), visited: Number(r.visited) };
  }
  return out;
}

export interface Pin {
  id: number;
  name: string;
  lat: number;
  lng: number;
  level: "country" | "region" | "city";
}

/** Visited places that have coordinates, for the Explore map pins. */
export async function getVisitedPins(userId: string): Promise<Pin[]> {
  const rows = await db.execute(sql`
    SELECT p.id, p.name, p.lat, p.lng, p.level
    FROM user_place_stats s
    JOIN places p ON p.id = s.place_id
    WHERE s.user_id = ${userId}
      AND p.lat IS NOT NULL AND p.lng IS NOT NULL
      AND p.level IN ('city', 'region', 'country')
  `);
  return (rows.rows as any[]).map((r) => ({
    id: Number(r.id),
    name: r.name,
    lat: Number(r.lat),
    lng: Number(r.lng),
    level: r.level,
  }));
}

// ─── general visit write (any place level) ────────────────────────────────────

export interface CreateVisitInput {
  placeId: number;
  arrivedAt?: string | null;
  departedAt?: string | null;
  purpose?: "lived" | "work" | "leisure" | "transit" | "layover";
  note?: string | null;
  tripId?: number | null;
}

export async function createVisit(
  userId: string,
  input: CreateVisitInput,
): Promise<VisitedSummary & { visitId: number }> {
  const { db: wdb, pool } = await createPool();
  let visitId = 0;
  try {
    const res = await wdb.execute(sql`
      INSERT INTO visits (user_id, place_id, arrived_at, departed_at, purpose, note, trip_id)
      VALUES (
        ${userId}, ${input.placeId},
        ${input.arrivedAt ?? null}, ${input.departedAt ?? null},
        ${input.purpose ?? "leisure"}, ${input.note ?? null}, ${input.tripId ?? null}
      )
      RETURNING id
    `);
    visitId = Number((res.rows[0] as any)?.id ?? 0);
    await recomputeUserPlaceStats(wdb, userId);
  } finally {
    await pool.end();
  }
  const summary = await getVisitedCountries(userId);
  return { ...summary, visitId };
}

/** Toggle a direct visit on any place (region/city/country). Returns visited state. */
export async function togglePlaceVisit(
  userId: string,
  placeId: number,
): Promise<{ placeId: number; visited: boolean }> {
  const { db: wdb, pool } = await createPool();
  try {
    const existing = await wdb.execute(sql`
      SELECT 1 FROM visits WHERE user_id = ${userId} AND place_id = ${placeId} LIMIT 1
    `);
    if (existing.rows.length > 0) {
      await wdb.execute(
        sql`DELETE FROM visits WHERE user_id = ${userId} AND place_id = ${placeId}`,
      );
    } else {
      await wdb.execute(sql`
        INSERT INTO visits (user_id, place_id, purpose) VALUES (${userId}, ${placeId}, 'leisure')
      `);
    }
    await recomputeUserPlaceStats(wdb, userId);
    const stat = await wdb.execute(sql`
      SELECT 1 FROM user_place_stats WHERE user_id = ${userId} AND place_id = ${placeId} LIMIT 1
    `);
    return { placeId, visited: stat.rows.length > 0 };
  } finally {
    await pool.end();
  }
}
