/**
 * Timelapse projection — the flagship. No new tables: it's a pure projection
 * over the dated visit log, same as every other stat. It orders visits into
 * per-month frames; the player maps frames → ~20s of screen time weighted by
 * density, so empty spans compress and busy months breathe.
 */

import type { EnrichedVisit } from "./trips";

const MONTHS = [
  "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
  "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER",
];

export interface TimelapseFrame {
  /** Bucket key, "YYYY-MM". */
  key: string;
  /** Large mono date label, e.g. "MARCH 2019". */
  label: string;
  /** Countries (ISO2) first filled in this frame — these flash white. */
  newIso: string[];
  /** Continents newly unlocked this frame (for the pulse + badge). */
  newContinents: string[];
  /** Cumulative counts through this frame. */
  countries: number;
  cities: number;
  /** Relative screen-time weight (busier frames linger). */
  weight: number;
}

export interface TimelapseResult {
  frames: TimelapseFrame[];
  /** Visits with no date — excluded from the timeline, surfaced at the end. */
  undatedCount: number;
  /** Union of all countries ever filled (final map state). */
  allIso: string[];
}

export interface TimelapseOptions {
  /** Restrict to these countries (continent / country scope). */
  include?: Set<string>;
  /** iso2 → continent name, for continent-unlock detection. */
  continentByIso?: Record<string, string>;
  includeTransit?: boolean;
}

const TRANSIT = new Set(["transit", "layover"]);

/**
 * Build the ordered frame list. One frame per month that has *new* progress
 * (a new country or new city); months with nothing new are skipped entirely,
 * which is what compresses empty time.
 */
export function timelapseFrames(
  visits: EnrichedVisit[],
  opts: TimelapseOptions = {},
): TimelapseResult {
  const { include, continentByIso = {}, includeTransit } = opts;
  const inScope = (v: EnrichedVisit) =>
    !!v.countryIso2 &&
    (!include || include.has(v.countryIso2)) &&
    (includeTransit || !TRANSIT.has(v.purpose));

  const dated = visits
    .filter((v) => v.arrivedAt && inScope(v))
    .sort((a, b) => (a.arrivedAt! < b.arrivedAt! ? -1 : a.arrivedAt! > b.arrivedAt! ? 1 : a.id - b.id));

  const byMonth = new Map<string, EnrichedVisit[]>();
  for (const v of dated) {
    const key = v.arrivedAt!.slice(0, 7); // YYYY-MM
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(v);
  }

  const seenCountries = new Set<string>();
  const seenCities = new Set<number>();
  const seenContinents = new Set<string>();
  const frames: TimelapseFrame[] = [];

  for (const [key, vs] of byMonth) {
    const newIso: string[] = [];
    const newContinents: string[] = [];
    let addedCities = 0;
    for (const v of vs) {
      const iso = v.countryIso2!;
      if (!seenCountries.has(iso)) {
        seenCountries.add(iso);
        newIso.push(iso);
        const cont = continentByIso[iso];
        if (cont && !seenContinents.has(cont)) {
          seenContinents.add(cont);
          newContinents.push(cont);
        }
      }
      if (v.placeLevel === "city" && !seenCities.has(v.placeId)) {
        seenCities.add(v.placeId);
        addedCities++;
      }
    }
    if (newIso.length === 0 && addedCities === 0) continue; // no progress this month
    const [y, m] = key.split("-");
    frames.push({
      key,
      label: `${MONTHS[Number(m) - 1] ?? ""} ${y}`,
      newIso,
      newContinents,
      countries: seenCountries.size,
      cities: seenCities.size,
      weight: Math.max(1, newIso.length + addedCities * 0.5),
    });
  }

  const undatedCount = visits.filter((v) => !v.arrivedAt && inScope(v)).length;
  return { frames, undatedCount, allIso: [...seenCountries] };
}

/**
 * Per-frame durations that fill `totalMs` (~20s), weighted by frame density and
 * clamped to a readable minimum. Returned array is parallel to `frames`.
 */
export function frameDurations(
  frames: TimelapseFrame[],
  totalMs = 20_000,
  minMs = 450,
): number[] {
  if (frames.length === 0) return [];
  const totalWeight = frames.reduce((s, f) => s + f.weight, 0) || 1;
  return frames.map((f) => Math.max(minMs, Math.round((f.weight / totalWeight) * totalMs)));
}
