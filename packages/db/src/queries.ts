import { defaultMapTheme, normalizeMapTheme, type MapTheme } from "@travld/core";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./client";
import { createPool } from "./pool";
import { places, users, visits } from "./schema";
import { recomputeUserPlaceStats } from "./stats";

// ─── reads (neon-http) ───────────────────────────────────────────────────────

export interface CountryRow {
  id: number;
  iso2: string | null;
  name: string;
  isUnMember: boolean;
}

/** All countries, alphabetical. Read-mostly reference data. */
export async function listCountries(): Promise<CountryRow[]> {
  return db
    .select({
      id: places.id,
      iso2: places.iso2,
      name: places.name,
      isUnMember: places.isUnMember,
    })
    .from(places)
    .where(eq(places.level, "country"))
    .orderBy(asc(places.name));
}

export interface VisitedSummary {
  /** ISO2 codes of visited countries — drives passport-map fills. */
  visitedIso2: string[];
  /** Count of visited UN-member countries (Been-parity numerator). */
  unCount: number;
  /** Count including non-UN territories. */
  totalCount: number;
}

/**
 * Derived visited-country set for a user, read from the userPlaceStats cache
 * (which is itself a projection of the visit log). Never a stored "visited" list.
 */
export async function getVisitedCountries(userId: string): Promise<VisitedSummary> {
  const rows = await db.execute(sql`
    SELECT p.iso2 AS iso2, p.is_un_member AS is_un_member
    FROM user_place_stats s
    JOIN places p ON p.id = s.place_id
    WHERE s.user_id = ${userId} AND p.level = 'country'
  `);
  const visitedIso2: string[] = [];
  let unCount = 0;
  for (const r of rows.rows as any[]) {
    if (r.iso2) visitedIso2.push(r.iso2);
    if (r.is_un_member) unCount++;
  }
  return { visitedIso2, unCount, totalCount: visitedIso2.length };
}

/** A user's map palette, falling back to the brand default when unset. */
export async function getMapTheme(userId: string): Promise<MapTheme> {
  const rows = await db
    .select({ mapTheme: users.mapTheme })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return normalizeMapTheme(rows[0]?.mapTheme ?? defaultMapTheme);
}

/** Persist a validated map palette for a user. Returns the normalized theme. */
export async function setMapTheme(userId: string, theme: unknown): Promise<MapTheme> {
  const normalized = normalizeMapTheme(theme);
  await db.update(users).set({ mapTheme: normalized }).where(eq(users.id, userId));
  return normalized;
}

export interface UserSettings {
  includeTransit: boolean;
}

export async function getSettings(userId: string): Promise<UserSettings> {
  const rows = await db
    .select({ includeTransit: users.includeTransit })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return { includeTransit: rows[0]?.includeTransit ?? false };
}

/** Persist settings; recompute stats when the layover rule changes the counts. */
export async function setSettings(
  userId: string,
  input: Partial<UserSettings>,
): Promise<UserSettings> {
  if (typeof input.includeTransit === "boolean") {
    const { db: wdb, pool } = await createPool();
    try {
      await wdb
        .update(users)
        .set({ includeTransit: input.includeTransit })
        .where(eq(users.id, userId));
      await recomputeUserPlaceStats(wdb, userId); // counts depend on this flag
    } finally {
      await pool.end();
    }
  }
  return getSettings(userId);
}

// ─── writes (neon-serverless WS pool, transactional recompute) ────────────────

export interface ToggleResult {
  placeId: number;
  visited: boolean;
  summary: VisitedSummary;
}

/**
 * Been-style country toggle. Marks/unmarks a country as visited by adding or
 * removing a direct visit on the country place, then rebuilds the derived stats.
 * If the country is still reachable via a city/region visit, it stays visited —
 * which is correct: "visited" is derived, not a flag.
 */
export async function toggleCountryVisit(
  userId: string,
  countryPlaceId: number,
): Promise<ToggleResult> {
  const { db: wdb, pool } = await createPool();
  try {
    const existing = await wdb
      .select({ id: visits.id })
      .from(visits)
      .where(and(eq(visits.userId, userId), eq(visits.placeId, countryPlaceId)))
      .limit(1);

    if (existing.length > 0) {
      await wdb
        .delete(visits)
        .where(and(eq(visits.userId, userId), eq(visits.placeId, countryPlaceId)));
    } else {
      await wdb.insert(visits).values({ userId, placeId: countryPlaceId, purpose: "leisure" });
    }

    await recomputeUserPlaceStats(wdb, userId);

    // read the derived state back through the same pool
    const rows = await wdb.execute(sql`
      SELECT p.iso2 AS iso2, p.is_un_member AS is_un_member
      FROM user_place_stats s
      JOIN places p ON p.id = s.place_id
      WHERE s.user_id = ${userId} AND p.level = 'country'
    `);
    const visitedIso2: string[] = [];
    let unCount = 0;
    let visited = false;
    const stillRows = rows.rows as any[];
    for (const r of stillRows) {
      if (r.iso2) visitedIso2.push(r.iso2);
      if (r.is_un_member) unCount++;
    }
    const stat = await wdb.execute(sql`
      SELECT 1 FROM user_place_stats WHERE user_id = ${userId} AND place_id = ${countryPlaceId} LIMIT 1
    `);
    visited = stat.rows.length > 0;

    return {
      placeId: countryPlaceId,
      visited,
      summary: { visitedIso2, unCount, totalCount: visitedIso2.length },
    };
  } finally {
    await pool.end();
  }
}
