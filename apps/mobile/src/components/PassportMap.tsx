import { mapColors } from "@travld/ui";
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
  /** ISO2 codes of visited countries. */
  visited: Set<string>;
  onToggle?: (iso2: string) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The Passport Map — the Been hero. Flat Robinson world, countries filled mint
 * on black, no labels, no tiles. Paths are pre-projected at build time (see
 * prebake-maps), so nothing computes geometry on device: instant and offline.
 */
export function PassportMap({ visited, onToggle, style }: Props) {
  const paths = useMemo(
    () =>
      WORLD.countries.map((c) => ({
        ...c,
        isVisited: visited.has(c.iso),
      })),
    [visited],
  );

  return (
    <View style={[{ aspectRatio: WORLD.width / WORLD.height, width: "100%" }, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}>
        <Rect x={0} y={0} width={WORLD.width} height={WORLD.height} fill={mapColors.water} />
        {paths.map((c) => (
          <Path
            key={c.iso}
            d={c.d}
            fill={c.isVisited ? mapColors.visited : mapColors.land}
            stroke={mapColors.water}
            strokeWidth={0.3}
            onPress={onToggle ? () => onToggle(c.iso) : undefined}
          />
        ))}
      </Svg>
    </View>
  );
}
