import type { MapTheme } from "@travld/core";

// Thin client for the travld API (apps/web). No auth yet — the server runs
// everything as the dev user until the auth phase.
//
// EXPO_PUBLIC_API_URL is inlined by Expo at build time. On a physical device,
// localhost won't reach your machine — set it to your LAN IP in apps/mobile/.env
// (e.g. EXPO_PUBLIC_API_URL=http://192.168.1.10:3000).
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

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
  createVisit: (input: {
    placeId: number;
    arrivedAt?: string | null;
    departedAt?: string | null;
    purpose?: "lived" | "work" | "leisure" | "transit" | "layover";
    note?: string | null;
  }) => json<VisitedSummary>("/api/visits", { method: "POST", body: JSON.stringify(input) }),
  getRegionProgress: () => json<{ progress: RegionProgress }>("/api/me/region-progress"),
  getPins: () => json<{ pins: Pin[] }>("/api/me/pins"),
  getSettings: () => json<{ settings: { includeTransit: boolean } }>("/api/me/settings"),
  setSettings: (s: { includeTransit: boolean }) =>
    json<{ settings: { includeTransit: boolean } }>("/api/me/settings", {
      method: "PATCH",
      body: JSON.stringify(s),
    }),

  // static admin-1 SVG maps served by the web app
  getAdmin1Map: (iso2: string) => json<Admin1Map>(`/maps/admin1/${iso2}.json`),

  // Phase 3 — social
  getFeed: () => json<{ feed: FeedItem[] }>("/api/feed"),
  getLeaderboard: () => json<{ leaderboard: LeaderRow[] }>("/api/leaderboard"),
  getFollowing: () => json<{ following: PersonRow[] }>("/api/following"),
  follow: (userId: string) =>
    json<{ ok: boolean }>("/api/follow", { method: "POST", body: JSON.stringify({ userId }) }),
  unfollow: (userId: string) =>
    json<{ ok: boolean }>("/api/follow", { method: "DELETE", body: JSON.stringify({ userId }) }),
  compare: (userId: string) => json<CompareResult>(`/api/compare/${userId}`),

  // Phase 4 — visualize
  getStats: () => json<VisualizeStats>("/api/me/stats"),
};

export interface VisualizeStats {
  totals: { countries: number; regions: number; cities: number };
  continents: { continent: string; countries: number }[];
  purposes: { purpose: string; count: number }[];
  timeline: { year: number; count: number }[];
  distanceKm: number;
}
