import { type ThemeColors, spacing, Text } from "@travld/ui";
import * as Haptics from "expo-haptics";
import { useCallback, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

interface Props {
  minYear: number;
  /** Far-right = "all time". */
  maxYear: number;
  /** Current selected year; `maxYear` means all time. */
  year: number;
  onChange: (year: number) => void;
  colors: ThemeColors;
  tint: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Thin year scrubber. Sits between the map and the sheet because it modifies the
 * map, not the stats: dragging filters the map to visits arrived on/before the
 * selected year. Far-right is "all time". Haptic tick on each year crossed.
 */
export function YearScrubber({ minYear, maxYear, year, onChange, colors, tint, style }: Props) {
  const [w, setW] = useState(0);
  const range = Math.max(1, maxYear - minYear);
  const frac = Math.max(0, Math.min(1, (year - minYear) / range));

  const onLayout = useCallback((e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width), []);

  const update = useCallback(
    (px: number) => {
      if (w <= 0) return;
      const f = Math.max(0, Math.min(1, px / w));
      const y = Math.round(minYear + f * range);
      if (y !== year) {
        void Haptics.selectionAsync();
        onChange(y);
      }
    },
    [w, minYear, range, year, onChange],
  );

  // runOnJS(true): the plain callback fires on the JS thread with view-local x.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => update(e.x))
    .onUpdate((e) => update(e.x));

  const isAllTime = year >= maxYear;

  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.labelRow}>
        <Text variant="body" style={[styles.label, { color: colors.textDim }]}>Timeline</Text>
        <Text variant="body" mono style={[styles.value, { color: isAllTime ? colors.textDim : tint }]}>
          {isAllTime ? "All time" : year}
        </Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.hit} onLayout={onLayout}>
          <View style={[styles.track, { backgroundColor: colors.tickEmpty }]} />
          <View style={[styles.fill, { width: `${frac * 100}%`, backgroundColor: tint }]} />
          <View style={[styles.thumb, { left: `${frac * 100}%`, backgroundColor: tint, borderColor: colors.bg }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "transparent",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
  },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 12 },
  value: { fontSize: 13, fontWeight: "700" },
  // A tall hit-area so the thin track is easy to grab.
  hit: { height: 28, justifyContent: "center" },
  track: { position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2 },
  fill: { position: "absolute", left: 0, height: 4, borderRadius: 2 },
  thumb: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    borderWidth: 2,
  },
});
