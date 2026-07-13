import { defaultMapTheme, type MapTheme } from "@travld/core";
import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import type { Admin1Map } from "@/lib/api";

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
  const regions = useMemo(
    () =>
      map.regions.map((r, i) => ({
        key: `${r.code ?? r.name ?? i}`,
        name: r.name,
        d: r.d,
        visited: r.name ? visitedNames.has(r.name.toLowerCase()) : false,
      })),
    [map, visitedNames],
  );

  return (
    <View style={[{ width: "100%" }, style]}>
      <Svg
        width="100%"
        viewBox={`0 0 ${map.width} ${map.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ aspectRatio: map.width / map.height }}
      >
        <Rect x={0} y={0} width={map.width} height={map.height} fill={theme.water} />
        {regions.map((r) => (
          <Path
            key={r.key}
            d={r.d}
            fill={r.visited ? theme.visited : theme.land}
            stroke={theme.water}
            strokeWidth={0.5}
            onPress={onRegionPress && r.name ? () => onRegionPress(r.name!) : undefined}
          />
        ))}
      </Svg>
    </View>
  );
}
