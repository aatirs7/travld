import { defaultMapTheme, type MapTheme } from "@travld/core";
import { useEffect, useMemo } from "react";
import { useAppColors } from "@/lib/app-theme";
import { type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
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

// Per-country polygon rings (paths are pure M/L/Z polygons), computed once — so
// a tap can be hit-tested in JS instead of relying on per-<Path> onPress, which
// steals drags and fires too eagerly. Each ring is a flat [x0,y0,x1,y1,…].
let COUNTRY_RINGS: Map<string, number[][]> | null = null;
function countryRings() {
  if (COUNTRY_RINGS) return COUNTRY_RINGS;
  const m = new Map<string, number[][]>();
  for (const c of WORLD.countries) {
    const rings: number[][] = [];
    for (const sub of c.d.split("M")) {
      if (!sub) continue;
      const nums = sub.match(/-?\d*\.?\d+(?:e-?\d+)?/gi);
      if (!nums || nums.length < 6) continue;
      rings.push(nums.map(Number));
    }
    if (rings.length) m.set(c.iso, rings);
  }
  COUNTRY_RINGS = m;
  return m;
}

/** Ray-casting even-odd test of a point against one flat [x0,y0,x1,y1,…] ring. */
function pointInRing(x: number, y: number, r: number[]): boolean {
  let inside = false;
  const n = r.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = r[i * 2]!, yi = r[i * 2 + 1]!;
    const xj = r[j * 2]!, yj = r[j * 2 + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** ISO2 of the country whose polygon contains the SVG point (smallest wins),
 *  or null if the point is in open water. */
function hitCountry(x: number, y: number): string | null {
  const rings = countryRings();
  const bbox = countryBBoxes();
  let best: string | null = null;
  let bestArea = Infinity;
  for (const [iso, polys] of rings) {
    let inside = false;
    for (const r of polys) if (pointInRing(x, y, r)) inside = !inside; // even-odd across rings (holes)
    if (!inside) continue;
    const b = bbox.get(iso);
    const area = b ? (b[2] - b[0]) * (b[3] - b[1]) : Infinity;
    if (area < bestArea) {
      bestArea = area;
      best = iso;
    }
  }
  return best;
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
  /** Countries to render white this instant (timelapse "just landed" flash). */
  flash?: Set<string>;
  /** Disable pinch/pan (e.g. during timelapse playback). */
  noZoom?: boolean;
  /** Fill the parent (flex:1) instead of the default 1.55 aspect-ratio card. */
  fill?: boolean;
  /** Long-press anywhere on the map — opens the map-variant menu (§2.1). */
  onLongPress?: () => void;
  /** Override the water/stroke color (default = app bg). Timelapse forces black. */
  background?: string;
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
  flash,
  noZoom,
  fill,
  onLongPress,
  background,
  style,
}: Props) {
  const tc = useAppColors();
  const bg = background ?? tc.bg;

  // Always "meet" so the WHOLE map is visible at rest (the Been passport look):
  // the world fits to width, letterboxed top/bottom with seamless black ocean.
  // Focus narrows the viewBox to a continent's bounds. Slice cropped the wide
  // world to a useless vertical strip in a tall full-screen container.
  const { viewBox, vb } = useMemo(() => {
    const full = { viewBox: VIEWBOX, vb: VB as number[] };
    if (!focus || focus.size === 0) return full;
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
    if (!isFinite(minX) || maxX <= minX || maxY <= minY) return full;
    const w = maxX - minX, h = maxY - minY;
    const pad = Math.max(w, h) * 0.08;
    const nvb = [minX - pad, minY - pad, w + pad * 2, h + pad * 2];
    return { viewBox: nvb.join(" "), vb: nvb };
  }, [focus]);
  const preserve = "xMidYMid meet" as const;

  // One unified gesture system: pinch to zoom, one-finger drag to pan, a clean
  // tap opens a country (hit-tested in JS — no per-<Path> onPress), long-press
  // opens the variant menu. Pan wins over tap, so dragging never selects.
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const containerW = useSharedValue(0);
  const containerH = useSharedValue(0);
  // viewBox width/height (world, or a continent when focused) — drives the clamp.
  const vbW = useSharedValue(VB[2]!);
  const vbH = useSharedValue(VB[3]!);
  useEffect(() => {
    vbW.value = vb[2]!;
    vbH.value = vb[3]!;
  }, [vb, vbW, vbH]);

  // Clamp the current translation so the map never pans past its own rendered
  // edge into empty space. Uses the actual rendered content size (viewBox fit to
  // the container with "meet", times the zoom) — not a bogus (scale-1) guess.
  const clampXY = () => {
    "worklet";
    const cw = containerW.value, ch = containerH.value;
    const vw = vbW.value, vh = vbH.value;
    if (!cw || !ch || !vw || !vh) return;
    const rs = Math.min(cw / vw, ch / vh); // "meet" render scale
    const maxX = Math.max(0, (vw * rs * scale.value - cw) / 2);
    const maxY = Math.max(0, (vh * rs * scale.value - ch) / 2);
    tx.value = Math.min(Math.max(tx.value, -maxX), maxX);
    ty.value = Math.min(Math.max(ty.value, -maxY), maxY);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 8);
      clampXY();
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const pan = Gesture.Pan()
    .minDistance(6)
    .onUpdate((e) => {
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
      clampXY();
    })
    .onEnd(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  // Long-press opens the map-variant menu. runOnJS so the plain callback fires
  // on the JS thread.
  const longPress = Gesture.LongPress()
    .minDuration(350)
    .onStart(() => onLongPress?.())
    .runOnJS(true);

  // Convert a container-space tap to an SVG point (undo the zoom/pan transform,
  // then the viewBox + preserveAspectRatio fit) and hit-test the country under it.
  const resolveTap = (px: number, py: number): string | null => {
    const w = containerW.value, h = containerH.value;
    if (!w || !h) return null;
    const zs = scale.value;
    const cx = w / 2, cy = h / 2;
    // undo transform: [translate, scale] about center
    const lx = cx + (px - cx - tx.value) / zs;
    const ly = cy + (py - cy - ty.value) / zs;
    const [vx, vy, vw, vh] = vb as [number, number, number, number];
    const s = Math.min(w / vw, h / vh); // "meet" fit
    const ox = (w - vw * s) / 2, oy = (h - vh * s) / 2;
    return hitCountry(vx + (lx - ox) / s, vy + (ly - oy) / s);
  };

  const tap = Gesture.Tap()
    .maxDistance(12)
    .runOnJS(true)
    .onEnd((e) => {
      if (!onToggle) return;
      const iso = resolveTap(e.x, e.y);
      if (iso) onToggle(iso);
    });

  // Exclusive priority: a drag (pan) beats a hold (longPress) beats a tap, so
  // dragging the map never opens a country. Pinch runs alongside.
  const zoomGesture = noZoom
    ? Gesture.Simultaneous(longPress)
    : Gesture.Simultaneous(pinch, Gesture.Exclusive(pan, longPress, tap));
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
        if (flash?.has(c.iso)) {
          fill = "#FFFFFF"; // just landed — flashes white before settling to mint
          fillOpacity = 1;
        }
        return { ...c, isVisited, fill, fillOpacity };
      }),
    [visited, variant, regionProgress, theme, focus, flash],
  );

  return (
    <GestureDetector gesture={zoomGesture}>
      <Animated.View
        onLayout={(e) => {
          containerW.value = e.nativeEvent.layout.width;
          containerH.value = e.nativeEvent.layout.height;
        }}
        style={[
          fill ? { flex: 1, overflow: "hidden" } : { width: "100%", aspectRatio: 1.55, overflow: "hidden" },
          style,
        ]}
      >
        <Animated.View style={zoomStyle}>
          <Svg
            width="100%"
            height="100%"
            viewBox={viewBox}
            preserveAspectRatio={preserve}
          >
            {/* water always == background so the map is seamless */}
            <Rect x={-200} y={-200} width={WORLD.width + 400} height={WORLD.height + 400} fill={bg} />
            {paths.map((p) => (
              <Path
                key={p.iso}
                d={p.d}
                fill={p.fill}
                fillOpacity={p.fillOpacity}
                stroke={bg}
                strokeWidth={0.5}
              />
            ))}
          </Svg>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
