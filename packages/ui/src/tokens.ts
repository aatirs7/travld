/**
 * travld design tokens — black canvas, one mint accent, nothing else.
 * (The original spec called for amber; the brand is mint green. One accent
 * color everywhere. No second hue. Restraint is the whole aesthetic.)
 */

export const colors = {
  bg: "#000000",
  surface: "#121212", // cards
  surfaceAlt: "#1E1E1E",
  grey: "#303032", // unvisited landmass
  textPrimary: "#FFFFFF",
  textDim: "#8A8A8E",
  mint: "#00E08F", // visited fill, active tab, all accents
  mintDim: "#0A7D52", // partial completion / "only them" in compare
} as const;

/** Passport-map fills derived from the palette. */
export const mapColors = {
  land: colors.grey,
  visited: colors.mint,
  partial: colors.mintDim,
  water: "#0A0A0A", // near-black
} as const;

export const typography = {
  /** The hero number: SF Pro Display Bold, mint. */
  hero: { fontSize: 64, fontWeight: "700", color: colors.mint, letterSpacing: -1 },
  label: { fontSize: 15, color: colors.textDim, letterSpacing: 0.5 },
  title: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  body: { fontSize: 17, color: colors.textPrimary },
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { card: 16, pill: 999 } as const;

export type Colors = typeof colors;
