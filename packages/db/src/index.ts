export * from "./schema";
export { db, schema, type Database } from "./client";
export { createPool } from "./pool";
export { recomputeUserPlaceStats } from "./stats";
export {
  listCountries,
  getVisitedCountries,
  toggleCountryVisit,
  getMapTheme,
  setMapTheme,
  getSettings,
  setSettings,
  type CountryRow,
  type VisitedSummary,
  type ToggleResult,
  type UserSettings,
} from "./queries";
export {
  searchPlaces,
  getCountryDetail,
  getPlaceCities,
  getCountryCities,
  getCountryVisits,
  getRegionProgress,
  getVisitedPins,
  createVisit,
  togglePlaceVisit,
  type Pin,
  type SearchResult,
  type CountryDetail,
  type RegionRow,
  type RegionProgress,
  type CreateVisitInput,
  type VisitRow,
} from "./queries-depth";
