import { describe, expect, it } from "vitest";
import {
  citiesVisited,
  continentsVisited,
  countriesVisited,
  percentOfWorld,
  placeAtLevel,
  type PlaceNode,
  type VisitLike,
} from "./index";

// A tiny hierarchy: Asia > Pakistan > Sindh > Karachi ; Asia > Japan > Tokyo-region > Tokyo
const nodes: PlaceNode[] = [
  { id: 1, level: "continent", parentId: null },
  { id: 2, level: "country", parentId: 1, isUnMember: true }, // Pakistan
  { id: 3, level: "region", parentId: 2 }, // Sindh
  { id: 4, level: "city", parentId: 3 }, // Karachi
  { id: 5, level: "country", parentId: 1, isUnMember: true }, // Japan
  { id: 6, level: "region", parentId: 5 }, // Tokyo region
  { id: 7, level: "city", parentId: 6 }, // Tokyo
];
const placesById = new Map(nodes.map((n) => [n.id, n]));

describe("visit-log projections", () => {
  it("derives country visits from city visits via ancestry", () => {
    const visits: VisitLike[] = [{ placeId: 4 }, { placeId: 7 }];
    const countries = countriesVisited(visits, placesById);
    expect([...countries].sort()).toEqual([2, 5]);
    expect(countries.size).toBe(2);
  });

  it("de-duplicates: two visits to the same country count once", () => {
    const visits: VisitLike[] = [{ placeId: 4 }, { placeId: 3 }, { placeId: 2 }];
    expect(countriesVisited(visits, placesById).size).toBe(1);
  });

  it("collapses to a single continent", () => {
    const visits: VisitLike[] = [{ placeId: 4 }, { placeId: 7 }];
    expect(continentsVisited(visits, placesById).size).toBe(1);
  });

  it("counts distinct cities", () => {
    const visits: VisitLike[] = [{ placeId: 4 }, { placeId: 7 }, { placeId: 4 }];
    expect(citiesVisited(visits, placesById).size).toBe(2);
  });

  it("excludes transit/layover by default, includes when asked", () => {
    const visits: VisitLike[] = [
      { placeId: 4, purpose: "leisure" },
      { placeId: 7, purpose: "transit" },
    ];
    expect(countriesVisited(visits, placesById).size).toBe(1);
    expect(countriesVisited(visits, placesById, { includeTransit: true }).size).toBe(2);
  });

  it("resolves an ancestor at a given level", () => {
    expect(placeAtLevel(4, "country", placesById)?.id).toBe(2);
    expect(placeAtLevel(4, "continent", placesById)?.id).toBe(1);
  });

  it("computes %world against the 195 denominator", () => {
    expect(percentOfWorld(39)).toBe(20);
  });
});
