import { defaultMapTheme, type MapTheme } from "@travld/core";
import { useMemo } from "react";
import { useAppColors } from "@/lib/app-theme";
import { type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
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

// Per-country projected bounding boxes, computed once — used to zoom the map to
// a focused continent (a set of iso2 codes).
let COUNTRY_BBOX: Map<string, [number, number, number, number]> | null = null;
function countryBBoxes() {
  if (COUNTRY_BBOX) return COUNTRY_BBOX;
  const m = new Map<string, [number, number, number, number]>();
  for (const c of WORLD.countries) {
    const nums = c.d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi);
    if (!nums) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = +nums[i]!, y = +nums[i + 1]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    if (isFinite(minX)) m.set(c.iso, [minX, minY, maxX, maxY]);
  }
  COUNTRY_BBOX = m;
  return m;
}

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
  /** iso2 codes to zoom/focus to (a continent). Others are dimmed. */
  focus?: Set<string>;
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
  focus,
  style,
}: Props) {
  const tc = useAppColors();

  // When focused on a continent, zoom the viewBox to that continent's bounds and
  // switch to "meet" so the whole continent shows (bg-colored margins stay seamless).
  const { viewBox, preserve } = useMemo(() => {
    if (!focus || focus.size === 0) return { viewBox: VIEWBOX, preserve: "xMidYMid slice" as const };
    const bb = countryBBoxes();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const iso of focus) {
      const b = bb.get(iso);
      if (!b) continue;
      if (b[0] < minX) minX = b[0];
      if (b[1] < minY) minY = b[1];
      if (b[2] > maxX) maxX = b[2];
      if (b[3] > maxY) maxY = b[3];
    }
    if (!isFinite(minX) || maxX <= minX || maxY <= minY)
      return { viewBox: VIEWBOX, preserve: "xMidYMid slice" as const };
    const w = maxX - minX, h = maxY - minY;
    const pad = Math.max(w, h) * 0.08;
    return {
      viewBox: `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`,
      preserve: "xMidYMid meet" as const,
    };
  }, [focus]);

  // Pinch-to-zoom + two-finger pan. Two fingers keeps single-tap country
  // selection (Path onPress) and the parent pagers conflict-free.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const reset = () => {
    "worklet";
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 6);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1.01) reset();
    });

  const pan = Gesture.Pan()
    .minPointers(2)
    .onUpdate((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const zoomGesture = Gesture.Simultaneous(pinch, pan);
  const zoomStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

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
        if (focus && focus.size > 0 && !focus.has(c.iso)) fillOpacity *= 0.28;
        return { ...c, isVisited, fill, fillOpacity };
      }),
    [visited, variant, regionProgress, theme, focus],
  );

  return (
    <GestureDetector gesture={zoomGesture}>
      <Animated.View style={[{ width: "100%", aspectRatio: 1.55, overflow: "hidden" }, style]}>
        <Animated.View style={zoomStyle}>
          <Svg
            width="100%"
            height="100%"
            viewBox={viewBox}
            preserveAspectRatio={preserve}
          >
            {/* water always == app background so the map is seamless */}
            <Rect x={-200} y={-200} width={WORLD.width + 400} height={WORLD.height + 400} fill={tc.bg} />
            {paths.map((p) => (
              <Path
                key={p.iso}
                d={p.d}
                fill={p.fill}
                fillOpacity={p.fillOpacity}
                stroke={tc.bg}
                strokeWidth={0.5}
                onPress={onToggle ? () => onToggle(p.iso) : undefined}
              />
            ))}
          </Svg>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
