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
};
