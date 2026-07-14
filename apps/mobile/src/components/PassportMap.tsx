import { defaultMapTheme, type MapTheme } from "@travld/core";
import { colors } from "@travld/ui";
import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import world from "../../assets/maps/world-countries-simplified.json";

type WorldMap = {
  width: number;
  height: number;
  viewBox?: number[];
  countries: { iso: string; name: string | null; d: string }[];
};

const WORLD = world as WorldMap;
// Tight land bounds (falls back to full frame). Rendered with "slice" so the
// land fills the container edge-to-edge — bigger and seamless, no ocean margin.
const VB = WORLD.viewBox ?? [0, 0, WORLD.width, WORLD.height];
const VIEWBOX = VB.join(" ");

interface Props {
  /** ISO2 codes of visited countries. */
  visited: Set<string>;
  onToggle?: (iso2: string) => void;
  /** User-customizable palette. */
  theme?: MapTheme;
  /** "world" = binary visited fill; "heatmap" = opacity by admin-1 completion. */
  variant?: "world" | "heatmap";
  /** iso2 → { total, visited } admin-1 counts, for the heatmap variant. */
  regionProgress?: Record<string, { total: number; visited: number }>;
  style?: StyleProp<ViewStyle>;
}

/**
 * The Passport Map — the Been hero. Flat Robinson world, countries filled mint
 * on black, no labels, no tiles. Paths are pre-projected at build time (see
 * prebake-maps), so nothing computes geometry on device: instant and offline.
 */
export function PassportMap({
  visited,
  onToggle,
  theme = defaultMapTheme,
  variant = "world",
  regionProgress,
  style,
}: Props) {
  const paths = useMemo(
    () =>
      WORLD.countries.map((c) => {
        const isVisited = visited.has(c.iso);
        let fill = isVisited ? theme.visited : theme.land;
        let fillOpacity = 1;
        if (variant === "heatmap") {
          const p = regionProgress?.[c.iso];
          if (p && p.total > 0 && p.visited > 0) {
            fill = theme.visited;
            // 0.25..1 opacity scaled by admin-1 completion — signals "deeper than Been"
            fillOpacity = 0.25 + 0.75 * (p.visited / p.total);
          } else {
            fill = theme.land;
          }
        }
        return { ...c, isVisited, fill, fillOpacity };
      }),
    [visited, variant, regionProgress, theme],
  );

  return (
    <View style={[{ width: "100%", aspectRatio: 1.55 }, style]}>
      <Svg
        width="100%"
        height="100%"
        viewBox={VIEWBOX}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* water always == app background so the map is seamless */}
        <Rect x={-200} y={-200} width={WORLD.width + 400} height={WORLD.height + 400} fill={colors.bg} />
        {paths.map((c) => (
          <Path
            key={c.iso}
            d={c.d}
            fill={c.fill}
            fillOpacity={c.fillOpacity}
            stroke={colors.bg}
            strokeWidth={0.5}
            onPress={onToggle ? () => onToggle(c.iso) : undefined}
          />
        ))}
      </Svg>
    </View>
  );
}
