/**
 * travld design tokens. Two palettes (dark / light) with identical keys so the
 * whole app can switch themes at runtime. One mint accent in both.
 */

import { Platform } from "react-native";

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  grey: string;
  textPrimary: string;
  textDim: string;
  mint: string;
  mintDim: string;
  /** Empty passport-strip tick (unvisited unit). */
  tickEmpty: string;
}

export const darkColors: ThemeColors = {
  bg: "#000000",
  surface: "#121212",
  surfaceAlt: "#1E1E1E",
  grey: "#303032", // unvisited landmass
  textPrimary: "#FFFFFF",
  textDim: "#8A8A8E",
  mint: "#00E08F",
  mintDim: "#0A7D52",
  tickEmpty: "#252527",
};

export const lightColors: ThemeColors = {
  bg: "#ECECF0", // light gray canvas
  surface: "#FFFFFF",
  surfaceAlt: "#E3E3EA",
  grey: "#C6C6CE", // unvisited landmass (light)
  textPrimary: "#0B0B0C",
  textDim: "#6C6C74",
  mint: "#00B878", // slightly deeper for contrast on light
  mintDim: "#0A7D52",
  tickEmpty: "#D5D5DD",
};

/**
 * System monospace family. Every figure in the app (percentages, ratios, years,
 * distances, counts) renders in this — the fastest signal of "engineered, not
 * decorative" and the clearest break from Been.
 */
export const fontMono = Platform.select({
  ios: "ui-monospace",
  android: "monospace",
  web: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
  default: "monospace",
}) as string;

export type ThemeMode = "dark" | "light";

export function paletteFor(mode: ThemeMode): ThemeColors {
  return mode === "light" ? lightColors : darkColors;
}

/** Default palette (dark). Screens use the themed `useAppColors()` hook instead. */
export const colors = darkColors;

export const typography = {
  hero: { fontSize: 64, fontWeight: "700", letterSpacing: -1 },
  label: { fontSize: 15, letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: "700" },
  body: { fontSize: 17 },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { card: 16, pill: 999 } as const;

export type Colors = ThemeColors;
