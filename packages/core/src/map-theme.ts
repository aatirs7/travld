/**
 * User-customizable passport-map palette. Pure data/domain — lives in core so
 * both the client (mobile/web) and the data layer can validate and default it.
 * `visited` is the hero fill, `land` the unvisited landmass, `water` the sea,
 * `partial` the dim shade for region-heatmap partial completion / "only them".
 */
export interface MapTheme {
  visited: string;
  land: string;
  water: string;
  partial: string;
}

/** Brand default (mint on black). Water = pure black so the map is seamless
 *  against the page background (like Been), with no visible map "box". */
export const defaultMapTheme: MapTheme = {
  visited: "#00E08F",
  land: "#303032",
  water: "#000000",
  partial: "#0A7D52",
};

export interface MapThemePreset {
  id: string;
  name: string;
  theme: MapTheme;
}

/** Curated starting points; users can also pick a fully custom `visited` color. */
export const mapThemePresets: MapThemePreset[] = [
  { id: "mint", name: "Mint", theme: defaultMapTheme },
  {
    id: "amber",
    name: "Amber",
    theme: { visited: "#FF9F0A", land: "#3A3A3C", water: "#000000", partial: "#B36F07" },
  },
  {
    id: "ice",
    name: "Ice",
    theme: { visited: "#4EA8FF", land: "#2A2E33", water: "#000000", partial: "#2E5C8A" },
  },
  {
    id: "rose",
    name: "Rose",
    theme: { visited: "#FF5D8F", land: "#332A2E", water: "#000000", partial: "#8A3355" },
  },
  {
    id: "mono",
    name: "Mono",
    theme: { visited: "#FFFFFF", land: "#2A2A2C", water: "#000000", partial: "#8A8A8E" },
  },
  {
    id: "violet",
    name: "Violet",
    theme: { visited: "#B18CFF", land: "#2C2A33", water: "#000000", partial: "#5E4E8A" },
  },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(v: unknown): v is string {
  return typeof v === "string" && HEX.test(v);
}

/** Validate + fill a partial/untrusted theme against defaults. */
export function normalizeMapTheme(input: unknown): MapTheme {
  const t = (input ?? {}) as Partial<Record<keyof MapTheme, unknown>>;
  const pick = (v: unknown, fallback: string) => (isHexColor(v) ? v : fallback);
  return {
    visited: pick(t.visited, defaultMapTheme.visited),
    land: pick(t.land, defaultMapTheme.land),
    water: pick(t.water, defaultMapTheme.water),
    partial: pick(t.partial, defaultMapTheme.partial),
  };
}
