import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { darkColors, type ThemeColors } from "./tokens";

export interface PassportStripProps {
  /** Total number of ticks (units at this level): 195 world, 27 Brazil states, … */
  units: number;
  /**
   * Which units are filled (visited). A number fills the first N ticks left→right
   * (progress-bar reading); a Set fills exact indices (map-position reading).
   */
  filled: number | Set<number>;
  /** Transit/layover-only units — rendered dimmer. Number = the N after `filled`. */
  transit?: number | Set<number>;
  /** Themed palette. Falls back to dark tokens. */
  colors?: ThemeColors;
  /** Overrides (default to the mint / mintDim / tickEmpty tokens). */
  visitedColor?: string;
  transitColor?: string;
  emptyColor?: string;
  height?: number;
  /** Max ticks actually rendered; above this the strip samples so 5,000 cities
   *  don't spawn 5,000 views. Each rendered tick then represents a bucket. */
  maxTicks?: number;
  style?: StyleProp<ViewStyle>;
}

type TickState = "visited" | "transit" | "empty";

/**
 * A horizontal strip of ticks — one per unit at the current level. Reads as a
 * progress bar and a boarding pass at once, holds the transit distinction the
 * donut cannot express, and one component serves every level of the hierarchy.
 *
 * At 195 units it's a barcode; at 3 it's three fat bars. Single row, `flex:1`
 * ticks — never overflows regardless of count.
 */
export function PassportStrip({
  units,
  filled,
  transit,
  colors = darkColors,
  visitedColor,
  transitColor,
  emptyColor,
  height = 26,
  maxTicks = 220,
  style,
}: PassportStripProps) {
  const vColor = visitedColor ?? colors.mint;
  const tColor = transitColor ?? colors.mintDim;
  const eColor = emptyColor ?? colors.tickEmpty;

  const states = useMemo<TickState[]>(() => {
    const n = Math.max(0, Math.floor(units));
    if (n === 0) return [];
    const filledIsSet = filled instanceof Set;
    const transitIsSet = transit instanceof Set;
    const filledCount = filledIsSet ? (filled as Set<number>).size : (filled as number);
    const transitCount = transitIsSet ? (transit as Set<number>).size : ((transit as number) ?? 0);

    // Sample down to maxTicks buckets when there are too many units to draw.
    const rendered = Math.min(n, maxTicks);
    const out: TickState[] = [];
    for (let i = 0; i < rendered; i++) {
      // The unit index this tick represents (bucketed when sampling).
      const idx = rendered === n ? i : Math.floor((i * n) / rendered);
      let s: TickState = "empty";
      if (filledIsSet) {
        if ((filled as Set<number>).has(idx)) s = "visited";
      } else if (idx < filledCount) {
        s = "visited";
      }
      if (s === "empty") {
        if (transitIsSet) {
          if ((transit as Set<number>).has(idx)) s = "transit";
        } else if (idx >= filledCount && idx < filledCount + transitCount) {
          s = "transit";
        }
      }
      out.push(s);
    }
    return out;
  }, [units, filled, transit, maxTicks]);

  return (
    <View style={[{ flexDirection: "row", height, alignItems: "stretch" }, style]}>
      {states.map((s, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            marginHorizontal: 0.75,
            borderRadius: 1.5,
            backgroundColor: s === "visited" ? vColor : s === "transit" ? tColor : eColor,
          }}
        />
      ))}
    </View>
  );
}
