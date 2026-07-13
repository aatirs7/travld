// Minimal ambient types for d3-geo-projection (no maintained @types package).
declare module "d3-geo-projection" {
  import type { GeoProjection } from "d3-geo";
  export function geoRobinson(): GeoProjection;
}
