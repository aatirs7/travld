import { defaultMapTheme, type MapTheme } from "@travld/core";
import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { normalizeName, type Admin1Map } from "@/lib/api";
import { useAppColors } from "@/lib/app-theme";

interface Props {
  map: Admin1Map;
  /** lowercased names of visited regions (best-effort NE↔GeoNames name match). */
  visitedNames: Set<string>;
  theme?: MapTheme;
  onRegionPress?: (name: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Per-country admin-1 map. Same SVG approach as PassportMap: pre-baked Mercator
 * paths, resolution-independent via viewBox. Region fills come from a name match
 * against the visited set (NE geometry vs GeoNames region list don't share codes).
 */
export function CountryMap({ map, visitedNames, theme = defaultMapTheme, onRegionPress, style }: Props) {
  const tc = useAppColors();
  const regions = useMemo(
    () =>
      map.regions.map((r, i) => ({
        key: `${r.code ?? r.name ?? i}`,
        name: r.name,
        d: r.d,
        visited: r.name ? visitedNames.has(normalizeName(r.name)) : false,
      })),
    [map, visitedNames],
  );

  // The pre-bake fits each country into a square canvas and centers it, so a
  // wide country (US) or tall one only occupies a band of the 800×800 box.
  // Derive a tight viewBox from the actual path coords so the country fills the
  // frame instead of floating small in the middle.
  const { viewBox, aspectRatio } = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of map.regions) {
      const nums = r.d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi);
      if (!nums) continue;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = +nums[i]!, y = +nums[i + 1]!;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (!isFinite(minX) || maxX <= minX || maxY <= minY) {
      return { viewBox: `0 0 ${map.width} ${map.height}`, aspectRatio: map.width / map.height };
    }
    const w = maxX - minX, h = maxY - minY;
    const pad = Math.max(w, h) * 0.04;
    return {
      viewBox: `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`,
      aspectRatio: (w + pad * 2) / (h + pad * 2),
    };
  }, [map]);

  return (
    <View style={[{ width: "100%" }, style]}>
      <Svg
        width="100%"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ aspectRatio }}
      >
        <Rect x={-map.width} y={-map.height} width={map.width * 3} height={map.height * 3} fill={tc.bg} />
        {regions.map((r) => (
          <Path
            key={r.key}
            d={r.d}
            fill={r.visited ? theme.visited : theme.land}
            stroke={tc.bg}
            strokeWidth={0.5}
            onPress={onRegionPress && r.name ? () => onRegionPress(r.name!) : undefined}
          />
        ))}
      </Svg>
    </View>
  );
}
