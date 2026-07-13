import { sql } from "drizzle-orm";
import { db } from "./client";
import { getVisitedCountries } from "./queries";

// ─── follows ─────────────────────────────────────────────────────────────────

export async function followUser(followerId: string, followingId: string): Promise<void> {
  if (followerId === followingId) return;
  await db.execute(sql`
    INSERT INTO follows (follower_id, following_id)
    VALUES (${followerId}, ${followingId})
    ON CONFLICT DO NOTHING
  `);
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await db.execute(
    sql`DELETE FROM follows WHERE follower_id = ${followerId} AND following_id = ${followingId}`,
  );
}

export interface PersonRow {
  id: string;
  handle: string;
  displayName: string;
  countries: number;
  following: boolean;
}

/** People the user follows, with country counts (Friends list + compare targets). */
export async function listFollowing(userId: string): Promise<PersonRow[]> {
  const rows = await db.execute(sql`
    SELECT u.id, u.handle, u.display_name AS "displayName",
           count(s.place_id) FILTER (WHERE p.level = 'country')::int AS countries
    FROM follows f
    JOIN users u ON u.id = f.following_id
    LEFT JOIN user_place_stats s ON s.user_id = u.id
    LEFT JOIN places p ON p.id = s.place_id
    WHERE f.follower_id = ${userId}
    GROUP BY u.id
    ORDER BY countries DESC
  `);
  return (rows.rows as any[]).map((r) => ({
    id: r.id,
    handle: r.handle,
    displayName: r.displayName,
    countries: Number(r.countries),
    following: true,
  }));
}

// ─── feed (chronological, no algorithm) ───────────────────────────────────────

export interface FeedItem {
  id: number;
  handle: string;
  displayName: string;
  placeName: string;
  placeLevel: string;
  countryName: string | null;
  createdAt: string;
}

export async function getFeed(userId: string, limit = 50): Promise<FeedItem[]> {
  const rows = await db.execute(sql`
    SELECT v.id, u.handle, u.display_name AS "displayName",
           p.name AS "placeName", p.level AS "placeLevel",
           cc.name AS "countryName", v.created_at AS "createdAt"
    FROM visits v
    JOIN users u ON u.id = v.user_id
    JOIN places p ON p.id = v.place_id
    LEFT JOIN places cc ON cc.level = 'country' AND cc.iso2 = COALESCE(p.country_code, p.iso2)
    WHERE v.user_id IN (SELECT following_id FROM follows WHERE follower_id = ${userId})
      AND v.is_private = false
    ORDER BY v.created_at DESC
    LIMIT ${limit}
  `);
  return rows.rows as unknown as FeedItem[];
}

// ─── leaderboard (among people you follow + you) ──────────────────────────────

export interface LeaderRow {
  id: string;
  handle: string;
  displayName: string;
  countries: number;
  regions: number;
  cities: number;
  isMe: boolean;
}

export async function getLeaderboard(userId: string): Promise<LeaderRow[]> {
  const rows = await db.execute(sql`
    SELECT u.id, u.handle, u.display_name AS "displayName",
           count(s.place_id) FILTER (WHERE p.level = 'country')::int AS countries,
           count(s.place_id) FILTER (WHERE p.level = 'region')::int AS regions,
           count(s.place_id) FILTER (WHERE p.level = 'city')::int AS cities
    FROM users u
    LEFT JOIN user_place_stats s ON s.user_id = u.id
    LEFT JOIN places p ON p.id = s.place_id
    WHERE u.id = ${userId}
       OR u.id IN (SELECT following_id FROM follows WHERE follower_id = ${userId})
    GROUP BY u.id
    ORDER BY countries DESC, cities DESC
  `);
  return (rows.rows as any[]).map((r) => ({
    id: r.id,
    handle: r.handle,
    displayName: r.displayName,
    countries: Number(r.countries),
    regions: Number(r.regions),
    cities: Number(r.cities),
    isMe: r.id === userId,
  }));
}

// ─── compare (the shareable overlap map) ──────────────────────────────────────

export interface CompareResult {
  otherHandle: string;
  otherName: string;
  both: string[];
  onlyMe: string[];
  onlyThem: string[];
}

export async function getCompare(userId: string, otherId: string): Promise<CompareResult | null> {
  const others = await db.execute(sql`
    SELECT handle, display_name AS "displayName" FROM users WHERE id = ${otherId} LIMIT 1
  `);
  const other = others.rows[0] as any;
  if (!other) return null;

  const [mine, theirs] = await Promise.all([
    getVisitedCountries(userId),
    getVisitedCountries(otherId),
  ]);
  const mineSet = new Set(mine.visitedIso2);
  const theirsSet = new Set(theirs.visitedIso2);
  const both: string[] = [];
  const onlyMe: string[] = [];
  const onlyThem: string[] = [];
  for (const iso of mineSet) (theirsSet.has(iso) ? both : onlyMe).push(iso);
  for (const iso of theirsSet) if (!mineSet.has(iso)) onlyThem.push(iso);

  return {
    otherHandle: other.handle,
    otherName: other.displayName,
    both,
    onlyMe,
    onlyThem,
  };
}
