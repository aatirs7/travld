import {
  deriveTrip,
  routeForTrip,
  sortVisits,
  tripsForUser,
  visitsForTrip,
  type DerivedTrip,
  type EnrichedVisit,
  type RoutePoint,
  type TripInput,
} from "@travld/core";
import { sql } from "drizzle-orm";
import { db } from "./client";
import { createPool } from "./pool";

function toIso(v: unknown): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchEnrichedVisits(userId: string): Promise<EnrichedVisit[]> {
  const rows = await db.execute(sql`
    SELECT v.id, v.place_id AS "placeId", v.trip_id AS "tripId",
           v.arrived_at AS "arrivedAt", v.departed_at AS "departedAt", v.purpose, v.note,
           p.name AS "placeName", p.level AS "placeLevel",
           COALESCE(p.country_code, p.iso2) AS "countryIso2", p.lat, p.lng
    FROM visits v JOIN places p ON p.id = v.place_id
    WHERE v.user_id = ${userId}
  `);
  return (rows.rows as any[]).map((r) => ({
    id: Number(r.id),
    placeId: Number(r.placeId),
    tripId: r.tripId != null ? Number(r.tripId) : null,
    arrivedAt: toIso(r.arrivedAt),
    departedAt: toIso(r.departedAt),
    purpose: r.purpose,
    note: r.note ?? null,
    placeName: r.placeName,
    placeLevel: r.placeLevel,
    countryIso2: r.countryIso2 ?? null,
    lat: r.lat != null ? Number(r.lat) : null,
    lng: r.lng != null ? Number(r.lng) : null,
  }));
}

async function fetchTrips(userId: string): Promise<TripInput[]> {
  const rows = await db.execute(sql`
    SELECT id, title, start_date AS "startDate", end_date AS "endDate"
    FROM trips WHERE user_id = ${userId}
  `);
  return (rows.rows as any[]).map((r) => ({
    id: Number(r.id),
    title: r.title,
    startDate: toIso(r.startDate),
    endDate: toIso(r.endDate),
  }));
}

/** Set of trip ids where a country was visited for the first time. */
function firstVisitTripIds(visits: EnrichedVisit[]): Set<number> {
  const ordered = sortVisits(visits);
  const seen = new Set<string>();
  const out = new Set<number>();
  for (const v of ordered) {
    if (!v.countryIso2 || seen.has(v.countryIso2)) continue;
    seen.add(v.countryIso2);
    if (v.tripId != null) out.add(v.tripId);
  }
  return out;
}

export interface TripListItem extends DerivedTrip {
  companions: string[];
  hasFirstVisit: boolean;
}

export async function getTrips(userId: string): Promise<TripListItem[]> {
  const [visits, trips] = await Promise.all([fetchEnrichedVisits(userId), fetchTrips(userId)]);
  const derived = tripsForUser(visits, trips);
  const firstTrips = firstVisitTripIds(visits);

  const compRows = await db.execute(sql`
    SELECT v.trip_id AS "tripId", u.handle
    FROM visit_tags t
    JOIN visits v ON v.id = t.visit_id
    JOIN users u ON u.id = t.tagged_user_id
    WHERE v.user_id = ${userId} AND t.status = 'accepted' AND v.trip_id IS NOT NULL
  `);
  const compByTrip = new Map<number, string[]>();
  for (const r of compRows.rows as any[]) {
    const id = Number(r.tripId);
    if (!compByTrip.has(id)) compByTrip.set(id, []);
    compByTrip.get(id)!.push(r.handle);
  }

  return derived.map((t) => ({
    ...t,
    companions: compByTrip.get(t.id) ?? [],
    hasFirstVisit: firstTrips.has(t.id),
  }));
}

/**
 * Every visit a user has, enriched and in chronological order. Powers the year
 * scrubber and timelapse — both are pure projections over this dated log.
 */
export async function getUserVisits(userId: string): Promise<EnrichedVisit[]> {
  return sortVisits(await fetchEnrichedVisits(userId));
}

/** Ungrouped visits (tripId null), newest first. Client groups by year. */
export async function getUngroupedVisits(userId: string): Promise<EnrichedVisit[]> {
  const visits = await fetchEnrichedVisits(userId);
  return visits
    .filter((v) => v.tripId == null)
    .sort((a, b) => (a.arrivedAt && b.arrivedAt ? (a.arrivedAt < b.arrivedAt ? 1 : -1) : b.id - a.id));
}

export interface TripDetail {
  trip: DerivedTrip;
  visits: EnrichedVisit[];
  route: RoutePoint[];
  companions: string[];
  distanceKm: number;
}

function haversineKm(a: RoutePoint, b: RoutePoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export async function getTripDetail(userId: string, tripId: number): Promise<TripDetail | null> {
  const [visits, trips] = await Promise.all([fetchEnrichedVisits(userId), fetchTrips(userId)]);
  const tripInput = trips.find((t) => t.id === tripId);
  if (!tripInput) return null;
  const trip = deriveTrip(tripInput, visits);
  const tv = visitsForTrip(visits, tripId);
  const route = routeForTrip(visits, tripId);
  let distanceKm = 0;
  for (let i = 1; i < route.length; i++) distanceKm += haversineKm(route[i - 1]!, route[i]!);

  const compRows = await db.execute(sql`
    SELECT DISTINCT u.handle
    FROM visit_tags t JOIN visits v ON v.id = t.visit_id JOIN users u ON u.id = t.tagged_user_id
    WHERE v.user_id = ${userId} AND v.trip_id = ${tripId} AND t.status = 'accepted'
  `);
  const companions = (compRows.rows as any[]).map((r) => r.handle);

  return { trip, visits: tv, route, companions, distanceKm: Math.round(distanceKm) };
}

// ─── mutations ─────────────────────────────────────────────────────────────

export async function createTrip(
  userId: string,
  title: string,
  startDate?: string | null,
  endDate?: string | null,
): Promise<number> {
  const rows = await db.execute(sql`
    INSERT INTO trips (user_id, title, start_date, end_date)
    VALUES (${userId}, ${title}, ${startDate ?? null}, ${endDate ?? null})
    RETURNING id
  `);
  return Number((rows.rows[0] as any).id);
}

export async function updateTrip(
  userId: string,
  tripId: number,
  patch: { title?: string; startDate?: string | null; endDate?: string | null },
): Promise<void> {
  await db.execute(sql`
    UPDATE trips SET
      title = COALESCE(${patch.title ?? null}, title),
      start_date = ${patch.startDate ?? null},
      end_date = ${patch.endDate ?? null}
    WHERE id = ${tripId} AND user_id = ${userId}
  `);
}

/** Delete a trip — nulls tripId on its visits first, NEVER deletes visits. */
export async function deleteTrip(userId: string, tripId: number): Promise<void> {
  const { db: wdb, pool } = await createPool();
  try {
    await wdb.transaction(async (tx) => {
      await tx.execute(sql`UPDATE visits SET trip_id = NULL WHERE trip_id = ${tripId} AND user_id = ${userId}`);
      await tx.execute(sql`DELETE FROM trips WHERE id = ${tripId} AND user_id = ${userId}`);
    });
  } finally {
    await pool.end();
  }
}

/** Assign a visit to a trip (or null to ungroup). Never deletes the visit. */
export async function setVisitTrip(
  userId: string,
  visitId: number,
  tripId: number | null,
): Promise<void> {
  await db.execute(sql`
    UPDATE visits SET trip_id = ${tripId} WHERE id = ${visitId} AND user_id = ${userId}
  `);
}
