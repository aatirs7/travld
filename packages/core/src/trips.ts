/**
 * Trips projections. A trip is a label on visits, never a source of truth:
 * deleting a trip only nulls `tripId`, never removes visits. A trip and a place
 * are two projections of the same visit log. All pure functions.
 */

export interface EnrichedVisit {
  id: number;
  placeId: number;
  tripId: number | null;
  arrivedAt: string | null;
  departedAt: string | null;
  purpose: string;
  note: string | null;
  placeName: string;
  placeLevel: string;
  countryIso2: string | null;
  lat: number | null;
  lng: number | null;
}

export interface TripInput {
  id: number;
  title: string;
  startDate: string | null;
  endDate: string | null;
}

export interface DerivedTrip {
  id: number;
  title: string;
  /** Derived from visit dates; falls back to the trip's own start/end. */
  startDate: string | null;
  endDate: string | null;
  stopCount: number;
  countryCount: number;
  days: number | null;
}

/** Visits ordered by arrival ascending; undated visits last in creation order. */
export function sortVisits(visits: EnrichedVisit[]): EnrichedVisit[] {
  return [...visits].sort((a, b) => {
    if (a.arrivedAt && b.arrivedAt) return a.arrivedAt < b.arrivedAt ? -1 : a.arrivedAt > b.arrivedAt ? 1 : a.id - b.id;
    if (a.arrivedAt) return -1; // dated before undated
    if (b.arrivedAt) return 1;
    return a.id - b.id; // both undated → creation order
  });
}

function daysBetween(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = Date.parse(end) - Date.parse(start);
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / 86_400_000) + 1;
}

export function visitsForTrip(visits: EnrichedVisit[], tripId: number): EnrichedVisit[] {
  return sortVisits(visits.filter((v) => v.tripId === tripId));
}

export function deriveTrip(trip: TripInput, allVisits: EnrichedVisit[]): DerivedTrip {
  const tv = visitsForTrip(allVisits, trip.id);
  const dated = tv.filter((v) => v.arrivedAt);
  const arrivals = dated.map((v) => v.arrivedAt!).sort();
  const ends = dated.map((v) => v.departedAt ?? v.arrivedAt!).sort();
  const startDate = arrivals[0] ?? trip.startDate;
  const endDate = ends[ends.length - 1] ?? trip.endDate;
  const countries = new Set(tv.map((v) => v.countryIso2).filter(Boolean));
  return {
    id: trip.id,
    title: trip.title,
    startDate,
    endDate,
    stopCount: tv.length,
    countryCount: countries.size,
    days: daysBetween(startDate, endDate),
  };
}

/** Trips reverse-chronological by derived start date (undated trips last). */
export function tripsForUser(visits: EnrichedVisit[], trips: TripInput[]): DerivedTrip[] {
  return trips
    .map((t) => deriveTrip(t, visits))
    .sort((a, b) => {
      if (a.startDate && b.startDate) return a.startDate < b.startDate ? 1 : -1;
      if (a.startDate) return -1;
      if (b.startDate) return 1;
      return b.id - a.id;
    });
}

/** Trips that contain a visit to this exact place. */
export function tripsForPlace(
  visits: EnrichedVisit[],
  trips: TripInput[],
  placeId: number,
): DerivedTrip[] {
  const tripIds = new Set(
    visits.filter((v) => v.placeId === placeId && v.tripId != null).map((v) => v.tripId!),
  );
  return tripsForUser(visits, trips.filter((t) => tripIds.has(t.id)));
}

/** How many times the user visited this exact place. */
export function revisitCount(visits: EnrichedVisit[], placeId: number): number {
  return visits.filter((v) => v.placeId === placeId).length;
}

const TRANSIT_PURPOSES = new Set(["transit", "layover"]);

/**
 * Countries (ISO2) the user had visited as of the end of `cutoffYear`, for the
 * year scrubber. A dated visit counts when its arrival year <= cutoffYear;
 * UNDATED visits are always included (they have no year, so no year can exclude
 * them). Transit/layover excluded unless `includeTransit`.
 */
export function visitedIsoAsOf(
  visits: EnrichedVisit[],
  cutoffYear: number,
  opts: { includeTransit?: boolean } = {},
): Set<string> {
  const out = new Set<string>();
  for (const v of visits) {
    if (!v.countryIso2) continue;
    if (!opts.includeTransit && TRANSIT_PURPOSES.has(v.purpose)) continue;
    if (v.arrivedAt) {
      const year = Number(v.arrivedAt.slice(0, 4));
      if (Number.isFinite(year) && year > cutoffYear) continue;
    }
    out.add(v.countryIso2);
  }
  return out;
}

/** Earliest arrival year in the log, or null if no visit is dated. */
export function earliestVisitYear(visits: EnrichedVisit[]): number | null {
  let min: number | null = null;
  for (const v of visits) {
    if (!v.arrivedAt) continue;
    const year = Number(v.arrivedAt.slice(0, 4));
    if (!Number.isFinite(year)) continue;
    if (min == null || year < min) min = year;
  }
  return min;
}

export interface RoutePoint {
  lat: number;
  lng: number;
  name: string;
  arrivedAt: string | null;
}

/** Ordered route points for a trip (only visits with coordinates). */
export function routeForTrip(visits: EnrichedVisit[], tripId: number): RoutePoint[] {
  return visitsForTrip(visits, tripId)
    .filter((v) => v.lat != null && v.lng != null)
    .map((v) => ({ lat: v.lat!, lng: v.lng!, name: v.placeName, arrivedAt: v.arrivedAt }));
}
