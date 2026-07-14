/**
 * travld domain projections.
 *
 * The whole product rests on one rule: never store a "visited countries" list as
 * source of truth. Every stat is a pure projection over the visit log. These
 * functions take raw visits + the place hierarchy and derive counts. They run
 * identically on mobile, web, and in tests — no I/O, no database.
 */

export type PlaceLevel = "continent" | "country" | "region" | "city";

export interface PlaceNode {
  id: number;
  level: PlaceLevel;
  parentId: number | null;
  isUnMember?: boolean;
}

export interface VisitLike {
  placeId: number;
  purpose?: "lived" | "work" | "leisure" | "transit" | "layover";
}

/** Been-parity default denominator: 195 (193 UN members + 2 observer states). */
export const UN_COUNTRY_DENOMINATOR = 195;

export interface ProjectionOptions {
  /** Include transit/layover visits in counts. Off by default (the "layover rule"). */
  includeTransit?: boolean;
}

const TRANSIT = new Set(["transit", "layover"]);

function isCounted(v: VisitLike, opts: ProjectionOptions): boolean {
  if (opts.includeTransit) return true;
  return !TRANSIT.has(v.purpose ?? "leisure");
}

/** Walk a place up to (and including) the root, yielding each ancestor node. */
export function ancestorsOf(
  placeId: number,
  placesById: Map<number, PlaceNode>,
): PlaceNode[] {
  const chain: PlaceNode[] = [];
  let current = placesById.get(placeId) ?? null;
  const seen = new Set<number>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.parentId != null ? placesById.get(current.parentId) ?? null : null;
  }
  return chain;
}

/** The ancestor (or the place itself) at a given level, or null. */
export function placeAtLevel(
  placeId: number,
  level: PlaceLevel,
  placesById: Map<number, PlaceNode>,
): PlaceNode | null {
  return ancestorsOf(placeId, placesById).find((p) => p.level === level) ?? null;
}

/** Set of place ids at `level` that the user has visited (derived via ancestry). */
export function placesVisitedAtLevel(
  visits: VisitLike[],
  level: PlaceLevel,
  placesById: Map<number, PlaceNode>,
  opts: ProjectionOptions = {},
): Set<number> {
  const out = new Set<number>();
  for (const v of visits) {
    if (!isCounted(v, opts)) continue;
    const node = placeAtLevel(v.placeId, level, placesById);
    if (node) out.add(node.id);
  }
  return out;
}

export function countriesVisited(
  visits: VisitLike[],
  placesById: Map<number, PlaceNode>,
  opts: ProjectionOptions = {},
): Set<number> {
  return placesVisitedAtLevel(visits, "country", placesById, opts);
}

export function continentsVisited(
  visits: VisitLike[],
  placesById: Map<number, PlaceNode>,
  opts: ProjectionOptions = {},
): Set<number> {
  return placesVisitedAtLevel(visits, "continent", placesById, opts);
}

export function regionsVisited(
  visits: VisitLike[],
  placesById: Map<number, PlaceNode>,
  opts: ProjectionOptions = {},
): Set<number> {
  return placesVisitedAtLevel(visits, "region", placesById, opts);
}

export function citiesVisited(
  visits: VisitLike[],
  placesById: Map<number, PlaceNode>,
  opts: ProjectionOptions = {},
): Set<number> {
  return placesVisitedAtLevel(visits, "city", placesById, opts);
}

export * from "./map-theme";
export * from "./trips";

export function percentOfWorld(
  countryCount: number,
  denominator: number = UN_COUNTRY_DENOMINATOR,
): number {
  if (denominator <= 0) return 0;
  return Math.round((countryCount / denominator) * 1000) / 10; // one decimal
}
