import { describe, expect, it } from "vitest";
import {
  deriveTrip,
  revisitCount,
  routeForTrip,
  tripsForPlace,
  tripsForUser,
  visitsForTrip,
  type EnrichedVisit,
  type TripInput,
} from "./trips.js";

const v = (o: Partial<EnrichedVisit> & { id: number }): EnrichedVisit => ({
  placeId: o.id,
  tripId: null,
  arrivedAt: null,
  departedAt: null,
  purpose: "leisure",
  note: null,
  placeName: `Place ${o.id}`,
  placeLevel: "city",
  countryIso2: "JP",
  lat: 35,
  lng: 139,
  ...o,
});

const trips: TripInput[] = [
  { id: 1, title: "Japan 2025", startDate: null, endDate: null },
  { id: 2, title: "Empty future trip", startDate: "2027-01-01", endDate: "2027-01-05" },
];

const visits: EnrichedVisit[] = [
  v({ id: 10, tripId: 1, arrivedAt: "2025-10-02", departedAt: "2025-10-05", countryIso2: "JP", placeName: "Tokyo" }),
  v({ id: 11, tripId: 1, arrivedAt: "2025-10-01", countryIso2: "JP", placeName: "Kyoto" }),
  v({ id: 12, tripId: 1, arrivedAt: null, countryIso2: "KR", placeName: "Seoul (undated)" }),
  v({ id: 13, tripId: null, arrivedAt: "2019-05-01", countryIso2: "JP", placeName: "Tokyo" }),
];

describe("trips projections", () => {
  it("orders trip visits by arrival, undated last", () => {
    const ordered = visitsForTrip(visits, 1).map((x) => x.placeName);
    expect(ordered).toEqual(["Kyoto", "Tokyo", "Seoul (undated)"]);
  });

  it("derives date range, stop count, country count, days", () => {
    const d = deriveTrip(trips[0]!, visits);
    expect(d.startDate).toBe("2025-10-01");
    expect(d.endDate).toBe("2025-10-05");
    expect(d.stopCount).toBe(3);
    expect(d.countryCount).toBe(2); // JP + KR
    expect(d.days).toBe(5);
  });

  it("falls back to the trip's own dates when it has no dated visits", () => {
    const d = deriveTrip(trips[1]!, visits);
    expect(d.startDate).toBe("2027-01-01");
    expect(d.stopCount).toBe(0); // empty trip is valid
  });

  it("sorts trips reverse-chronologically by derived start", () => {
    const list = tripsForUser(visits, trips).map((t) => t.id);
    expect(list).toEqual([2, 1]); // 2027 before 2025
  });

  it("finds trips for a place and counts revisits", () => {
    expect(revisitCount(visits, 10)).toBe(1);
    // place 10 (Tokyo) is only in trip 1
    expect(tripsForPlace(visits, trips, 10).map((t) => t.id)).toEqual([1]);
  });

  it("builds an ordered route of coordinate stops", () => {
    const route = routeForTrip(visits, 1).map((r) => r.name);
    expect(route).toEqual(["Kyoto", "Tokyo", "Seoul (undated)"]);
  });
});
