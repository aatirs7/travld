import { sql } from "drizzle-orm";
import { db } from "./client";

export interface VisualizeStats {
  totals: { countries: number; regions: number; cities: number };
  continents: { continent: string; countries: number }[];
  purposes: { purpose: string; count: number }[];
  timeline: { year: number; count: number }[];
  distanceKm: number;
  trips: {
    total: number;
    longestDays: number;
    mostCountries: number;
    perYear: { year: number; count: number }[];
  };
}

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** All Visualize projections over the visit log for one user. */
export async function getVisualizeStats(userId: string): Promise<VisualizeStats> {
  const totalsRes = await db.execute(sql`
    SELECT p.level, count(*)::int AS n
    FROM user_place_stats s JOIN places p ON p.id = s.place_id
    WHERE s.user_id = ${userId} AND p.level IN ('country','region','city')
    GROUP BY p.level
  `);
  const totals = { countries: 0, regions: 0, cities: 0 };
  for (const r of totalsRes.rows as any[]) {
    if (r.level === "country") totals.countries = Number(r.n);
    if (r.level === "region") totals.regions = Number(r.n);
    if (r.level === "city") totals.cities = Number(r.n);
  }

  const contRes = await db.execute(sql`
    SELECT cont.name AS continent, count(*)::int AS countries
    FROM user_place_stats s
    JOIN places c ON c.id = s.place_id AND c.level = 'country'
    JOIN places cont ON cont.id = c.parent_id
    WHERE s.user_id = ${userId}
    GROUP BY cont.name
    ORDER BY countries DESC
  `);
  const continents = (contRes.rows as any[]).map((r) => ({
    continent: r.continent,
    countries: Number(r.countries),
  }));

  const purpRes = await db.execute(sql`
    SELECT purpose, count(*)::int AS count FROM visits
    WHERE user_id = ${userId} GROUP BY purpose ORDER BY count DESC
  `);
  const purposes = (purpRes.rows as any[]).map((r) => ({
    purpose: r.purpose,
    count: Number(r.count),
  }));

  const tlRes = await db.execute(sql`
    SELECT EXTRACT(YEAR FROM COALESCE(arrived_at, created_at))::int AS year, count(*)::int AS count
    FROM visits WHERE user_id = ${userId}
    GROUP BY year ORDER BY year
  `);
  const timeline = (tlRes.rows as any[])
    .filter((r) => r.year != null)
    .map((r) => ({ year: Number(r.year), count: Number(r.count) }));

  // distance from home to each visited city with coords (haversine sum)
  const homeRes = await db.execute(sql`
    SELECT hp.lat, hp.lng FROM users u
    JOIN places hp ON hp.id = u.home_place_id
    WHERE u.id = ${userId} LIMIT 1
  `);
  const home = homeRes.rows[0] as any;
  let distanceKm = 0;
  if (home?.lat != null && home?.lng != null) {
    const citiesRes = await db.execute(sql`
      SELECT p.lat, p.lng FROM user_place_stats s
      JOIN places p ON p.id = s.place_id
      WHERE s.user_id = ${userId} AND p.level = 'city' AND p.lat IS NOT NULL AND p.lng IS NOT NULL
    `);
    const h: [number, number] = [Number(home.lat), Number(home.lng)];
    for (const c of citiesRes.rows as any[]) {
      distanceKm += haversineKm(h, [Number(c.lat), Number(c.lng)]);
    }
  }

  // trip stats
  const tripAggRes = await db.execute(sql`
    WITH trip_agg AS (
      SELECT t.id,
        EXTRACT(YEAR FROM COALESCE(MIN(v.arrived_at), t.start_date))::int AS year,
        (MAX(COALESCE(v.departed_at, v.arrived_at))::date - MIN(v.arrived_at)::date + 1) AS days,
        COUNT(DISTINCT COALESCE(p.country_code, p.iso2)) AS countries
      FROM trips t
      LEFT JOIN visits v ON v.trip_id = t.id
      LEFT JOIN places p ON p.id = v.place_id
      WHERE t.user_id = ${userId}
      GROUP BY t.id, t.start_date
    )
    SELECT count(*)::int AS total,
           COALESCE(max(days), 0)::int AS "longestDays",
           COALESCE(max(countries), 0)::int AS "mostCountries"
    FROM trip_agg
  `);
  const tripAgg = (tripAggRes.rows[0] as any) ?? {};
  const perYearRes = await db.execute(sql`
    SELECT year, count(*)::int AS count FROM (
      SELECT EXTRACT(YEAR FROM COALESCE(MIN(v.arrived_at), t.start_date))::int AS year
      FROM trips t LEFT JOIN visits v ON v.trip_id = t.id
      WHERE t.user_id = ${userId}
      GROUP BY t.id, t.start_date
    ) sub
    WHERE year IS NOT NULL
    GROUP BY year
  `);
  const perYear = (perYearRes.rows as any[])
    .filter((r) => r.year != null)
    .map((r) => ({ year: Number(r.year), count: Number(r.count) }));

  return {
    totals,
    continents,
    purposes,
    timeline,
    distanceKm: Math.round(distanceKm),
    trips: {
      total: Number(tripAgg.total ?? 0),
      longestDays: Number(tripAgg.longestDays ?? 0),
      mostCountries: Number(tripAgg.mostCountries ?? 0),
      perYear,
    },
  };
}
