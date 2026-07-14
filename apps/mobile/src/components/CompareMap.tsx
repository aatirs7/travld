import { defaultMapTheme, type MapTheme } from "@travld/core";
import { useAppColors } from "@/lib/app-theme";
import { useMemo } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import world from "../../assets/maps/world-countries-simplified.json";

type WorldMap = {
  width: number;
  height: number;
  countries: { iso: string; name: string | null; d: string }[];
};
const WORLD = world as WorldMap;

interface Props {
  both: Set<string>;
  onlyMe: Set<string>;
  onlyThem: Set<string>;
  theme?: MapTheme;
  style?: StyleProp<ViewStyle>;
}

/**
 * Compare map: three fills — both (full accent), only-you (dim accent),
 * only-them (neutral highlight). The screenshot that drives installs.
 */
export function CompareMap({ both, onlyMe, onlyThem, theme = defaultMapTheme, style }: Props) {
  const tc = useAppColors();
  const paths = useMemo(
    () =>
      WORLD.countries.map((c) => {
        let fill = theme.land;
        if (both.has(c.iso)) fill = theme.visited;
        else if (onlyMe.has(c.iso)) fill = theme.partial;
        else if (onlyThem.has(c.iso)) fill = tc.textDim;
        return { iso: c.iso, d: c.d, fill };
      }),
    [both, onlyMe, onlyThem, theme, tc],
  );

  return (
    <View style={[{ width: "100%" }, style]}>
      <Svg
        width="100%"
        viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ aspectRatio: WORLD.width / WORLD.height }}
      >
        <Rect x={0} y={0} width={WORLD.width} height={WORLD.height} fill={tc.bg} />
        {paths.map((c) => (
          <Path key={c.iso} d={c.d} fill={c.fill} stroke={tc.bg} strokeWidth={0.3} />
        ))}
      </Svg>
    </View>
  );
}
