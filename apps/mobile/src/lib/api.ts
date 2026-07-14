import type { DerivedTrip, EnrichedVisit, MapTheme, RoutePoint } from "@travld/core";
import { BASE_URL, isNetworkError } from "./config";
import { getCache, setCache } from "./local-flags";
import { enqueue } from "./offline-queue";

// Thin client for the travld API (apps/web). No auth yet — the server runs
// everything as the dev user until the auth phase.
export { BASE_URL, isNetworkError };

export interface VisitedSummary {
  visitedIso2: string[];
  unCount: number;
  totalCount: number;
}

export interface CountryRow {
  id: number;
  iso2: string | null;
  name: string;
  isUnMember: boolean;
  continent: string | null;
}

/** Normalize a place name for matching across data sources (NE ↔ GeoNames):
 *  lowercase, strip accents and non-alphanumerics. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** ISO2 → flag emoji (regional indicator symbols). */
export function flagEmoji(iso2: string | null): string {
  if (!iso2 || iso2.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + (iso2.charCodeAt(0) - 65), A + (iso2.charCodeAt(1) - 65));
}

export interface ToggleResult {
  placeId: number;
  visited: boolean;
  summary: VisitedSummary;
}

export type PlaceLevel = "continent" | "country" | "region" | "city";

export interface SearchResult {
  id: number;
  name: string;
  level: PlaceLevel;
  displayType: string | null;
  countryName: string | null;
  countryIso2: string | null;
  lat: number | null;
  lng: number | null;
}

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

export interface CityRow {
  id: number;
  name: string;
  population: number | null;
  visited: boolean;
}

export interface Admin1Map {
  iso: string;
  projection: string;
  width: number;
  height: number;
  regions: { code: string | null; name: string | null; d: string }[];
}

export interface Pin {
  id: number;
  name: string;
  lat: number;
  lng: number;
  level: "country" | "region" | "city";
}

export interface VisitDetailRow {
  id: number;
  placeName: string;
  placeLevel: PlaceLevel;
  purpose: string;
  arrivedAt: string | null;
  note: string | null;
  tripId: number | null;
  tripTitle: string | null;
}

export type RegionProgress = Record<string, { total: number; visited: number }>;

export interface FeedItem {
  id: number;
  handle: string;
  displayName: string;
  placeName: string;
  placeLevel: string;
  countryName: string | null;
  createdAt: string;
}

export interface LeaderRow {
  id: string;
  handle: string;
  displayName: string;
  countries: number;
  regions: number;
  cities: number;
  isMe: boolean;
}

export interface PersonRow {
  id: string;
  handle: string;
  displayName: string;
  countries: number;
  following: boolean;
}

export interface CompareResult {
  otherHandle: string;
  otherName: string;
  both: string[];
  onlyMe: string[];
  onlyThem: string[];
}

export interface UserSearchRow {
  id: string;
  handle: string;
  displayName: string;
}

export interface PendingTag {
  visitId: number;
  taggerName: string;
  placeId: number;
  placeName: string;
  countryName: string | null;
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  getVisited: () => json<VisitedSummary>("/api/me/visited"),
  listCountries: () => json<{ countries: CountryRow[] }>("/api/countries"),
  toggleCountry: (placeId: number) =>
    json<ToggleResult>("/api/visits/toggle-country", {
      method: "POST",
      body: JSON.stringify({ placeId }),
    }),
  getTheme: () => json<{ theme: MapTheme }>("/api/me/theme"),
  setTheme: (theme: MapTheme) =>
    json<{ theme: MapTheme }>("/api/me/theme", {
      method: "PATCH",
      body: JSON.stringify({ theme }),
    }),

  // Phase 2 — depth
  search: (q: string) =>
    json<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(q)}`),
  getCountry: (iso2: string) => json<CountryDetail>(`/api/countries/${iso2}`),
  getCountryCities: (iso2: string, limit = 100) =>
    json<{ cities: CityRow[] }>(`/api/countries/${iso2}/cities?limit=${limit}`),
  getCountryVisits: (iso2: string) =>
    json<{ visits: VisitDetailRow[] }>(`/api/countries/${iso2}/visits`),
  getCities: (placeId: number, limit = 100) =>
    json<{ cities: CityRow[] }>(`/api/places/${placeId}/cities?limit=${limit}`),
  togglePlace: (placeId: number) =>
    json<{ placeId: number; visited: boolean }>(`/api/places/${placeId}/toggle`, {
      method: "POST",
    }),
  createVisit: async (input: {
    placeId: number;
    arrivedAt?: string | null;
    departedAt?: string | null;
    purpose?: "lived" | "work" | "leisure" | "transit" | "layover";
    note?: string | null;
    tripId?: number | null;
  }): Promise<VisitedSummary & { visitId: number; queued?: boolean }> => {
    try {
      return await json<VisitedSummary & { visitId: number }>("/api/visits", {
        method: "POST",
        body: JSON.stringify(input),
      });
    } catch (e) {
      if (isNetworkError(e)) {
        // offline: persist and replay on reconnect
        enqueue({ method: "POST", path: "/api/visits", body: input });
        return { visitedIso2: [], unCount: 0, totalCount: 0, visitId: 0, queued: true };
      }
      throw e;
    }
  },
  getRegionProgress: () => json<{ progress: RegionProgress }>("/api/me/region-progress"),
  getPins: () => json<{ pins: Pin[] }>("/api/me/pins"),
  getSettings: () => json<{ settings: { includeTransit: boolean } }>("/api/me/settings"),
  setSettings: (s: { includeTransit: boolean }) =>
    json<{ settings: { includeTransit: boolean } }>("/api/me/settings", {
      method: "PATCH",
      body: JSON.stringify(s),
    }),

  // static admin-1 SVG maps served by the web app
  // Admin-1 geometry never changes — serve from the local cache and only hit the
  // CDN on a cache miss, then persist it forever.
  getAdmin1Map: async (iso2: string): Promise<Admin1Map> => {
    const cached = getCache<Admin1Map>(`admin1:${iso2}`);
    if (cached) return cached;
    const map = await json<Admin1Map>(`/maps/admin1/${iso2}.json`);
    setCache(`admin1:${iso2}`, map);
    return map;
  },

  // Phase 3 — social
  getFeed: () => json<{ feed: FeedItem[] }>("/api/feed"),
  getLeaderboard: () => json<{ leaderboard: LeaderRow[] }>("/api/leaderboard"),
  getFollowing: () => json<{ following: PersonRow[] }>("/api/following"),
  follow: (userId: string) =>
    json<{ ok: boolean }>("/api/follow", { method: "POST", body: JSON.stringify({ userId }) }),
  unfollow: (userId: string) =>
    json<{ ok: boolean }>("/api/follow", { method: "DELETE", body: JSON.stringify({ userId }) }),
  compare: (userId: string) => json<CompareResult>(`/api/compare/${userId}`),

  // tagging + push
  registerPushToken: (token: string) =>
    json<{ ok: boolean }>("/api/me/push-token", { method: "POST", body: JSON.stringify({ token }) }),
  searchUsers: (q: string) =>
    json<{ users: UserSearchRow[] }>(`/api/users/search?q=${encodeURIComponent(q)}`),
  tagVisit: (visitId: number, taggedUserId: string) =>
    json<{ ok: boolean }>(`/api/visits/${visitId}/tag`, {
      method: "POST",
      body: JSON.stringify({ taggedUserId }),
    }),
  getPendingTags: () => json<{ tags: PendingTag[] }>("/api/me/tags"),
  respondTag: (visitId: number, accept: boolean) =>
    json<{ ok: boolean }>("/api/me/tags/respond", {
      method: "POST",
      body: JSON.stringify({ visitId, accept }),
    }),

  // Phase 4 — visualize
  getStats: () => json<VisualizeStats>("/api/me/stats"),

  // Full dated visit log — powers the year scrubber and timelapse. Cache-first
  // so the scrubber paints instantly, then revalidate.
  getUserVisits: async (): Promise<EnrichedVisit[]> => {
    const cached = getCache<EnrichedVisit[]>("visits:me");
    void json<{ visits: EnrichedVisit[] }>("/api/me/visits")
      .then((r) => setCache("visits:me", r.visits))
      .catch(() => {});
    if (cached) return cached;
    const r = await json<{ visits: EnrichedVisit[] }>("/api/me/visits");
    setCache("visits:me", r.visits);
    return r.visits;
  },

  // Trips
  getTrips: () => json<{ trips: TripListItem[] }>("/api/trips"),
  getUngrouped: () => json<{ visits: EnrichedVisit[] }>("/api/trips/ungrouped"),
  getTrip: (id: number) => json<TripDetail>(`/api/trips/${id}`),
  createTrip: (title: string, startDate?: string | null, endDate?: string | null) =>
    json<{ id: number }>("/api/trips", {
      method: "POST",
      body: JSON.stringify({ title, startDate, endDate }),
    }),
  updateTrip: (id: number, patch: { title?: string; startDate?: string | null; endDate?: string | null }) =>
    json<{ ok: boolean }>(`/api/trips/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteTrip: (id: number) => json<{ ok: boolean }>(`/api/trips/${id}`, { method: "DELETE" }),
  setVisitTrip: (visitId: number, tripId: number | null) =>
    json<{ ok: boolean }>(`/api/visits/${visitId}/trip`, {
      method: "POST",
      body: JSON.stringify({ tripId }),
    }),
};

export interface TripListItem extends DerivedTrip {
  companions: string[];
  hasFirstVisit: boolean;
}

export interface TripDetail {
  trip: DerivedTrip;
  visits: EnrichedVisit[];
  route: RoutePoint[];
  companions: string[];
  distanceKm: number;
}

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
