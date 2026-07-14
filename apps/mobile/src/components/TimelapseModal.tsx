import {
  frameDurations,
  pluralize,
  timelapseFrames,
  type EnrichedVisit,
  type MapTheme,
} from "@travld/core";
import { type ThemeColors, spacing, Text } from "@travld/ui";
import { SymbolView } from "expo-symbols";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { PassportMap } from "@/components/PassportMap";
import { useAppColors } from "@/lib/app-theme";

type Level = { kind: "world" } | { kind: "continent"; name: string };

interface Props {
  visible: boolean;
  onClose: () => void;
  visits: EnrichedVisit[];
  continentByIso: Record<string, string>;
  continentSets: Map<string, { iso: Set<string>; total: number }>;
  theme: MapTheme;
}

/**
 * Timelapse playback (§4). Full-screen, black, chrome = close + scrub bar. The
 * map starts empty and fills chronologically; each new country flashes white
 * then settles mint. Pure JS projection over the visit log — no export (deferred
 * to a native build), so there's a clean seam where share will later attach.
 */
export function TimelapseModal({ visible, onClose, visits, continentByIso, continentSets, theme }: Props) {
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);
  const [level, setLevel] = useState<Level>({ kind: "world" });
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);

  const { frames, durations, undatedCount } = useMemo(() => {
    const include = level.kind === "continent" ? continentSets.get(level.name)?.iso : undefined;
    const r = timelapseFrames(visits, { include, continentByIso });
    return { frames: r.frames, durations: frameDurations(r.frames), undatedCount: r.undatedCount };
  }, [visits, level, continentSets, continentByIso]);

  const focus = level.kind === "continent" ? continentSets.get(level.name)?.iso : undefined;

  // Reset + autoplay whenever opened or the level changes.
  useEffect(() => {
    if (visible) {
      setIdx(0);
      setPlaying(frames.length > 0);
    }
  }, [visible, level, frames.length]);

  // Advance one frame after the *next* frame's weighted duration.
  useEffect(() => {
    if (!visible || !playing) return;
    if (idx >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIdx((i) => i + 1), durations[idx + 1] ?? 500);
    return () => clearTimeout(t);
  }, [visible, playing, idx, frames.length, durations]);

  // Settled (mint) = every frame before the cursor; flash (white) = current frame.
  const settled = useMemo(() => {
    const s = new Set<string>();
    for (let i = 0; i < idx && i < frames.length; i++) for (const iso of frames[i]!.newIso) s.add(iso);
    return s;
  }, [idx, frames]);
  const flash = useMemo(() => new Set(frames[idx]?.newIso ?? []), [idx, frames]);

  const cur = frames[idx];
  const atEnd = !playing && frames.length > 0 && idx >= frames.length - 1;
  const progress = frames.length > 1 ? idx / (frames.length - 1) : frames.length ? 1 : 0;

  const [barW, setBarW] = useState(0);
  const seek = Gesture.Pan()
    .runOnJS(true)
    .onBegin((e) => seekTo(e.x))
    .onUpdate((e) => seekTo(e.x));
  function seekTo(px: number) {
    if (barW <= 0 || frames.length === 0) return;
    const f = Math.max(0, Math.min(1, px / barW));
    setPlaying(false);
    setIdx(Math.round(f * (frames.length - 1)));
  }

  const replay = () => {
    setIdx(0);
    setPlaying(frames.length > 0);
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {/* map layer */}
        <View style={StyleSheet.absoluteFill}>
          {frames.length > 0 && (
            <PassportMap
              fill
              noZoom
              visited={settled}
              flash={flash}
              focus={focus}
              theme={theme}
              background="#000000"
            />
          )}
        </View>

        {/* date + counter */}
        <View style={styles.top} pointerEvents="none">
          {cur ? (
            <>
              <Text variant="hero" mono style={styles.date}>{cur.label}</Text>
              <Text variant="body" mono style={styles.counter}>
                {pluralize(cur.countries, "country", "countries")} · {pluralize(cur.cities, "city", "cities")}
              </Text>
              {cur.newContinents.length > 0 && (
                <Text variant="body" style={styles.continent}>＋ {cur.newContinents.join(", ")}</Text>
              )}
            </>
          ) : (
            <Text variant="hero" style={styles.emptyTitle}>No dated visits yet</Text>
          )}
        </View>

        {/* close */}
        <Pressable onPress={onClose} hitSlop={16} style={[styles.close, { top: 52 }]}>
          <SymbolView name="xmark.circle.fill" size={30} tintColor="#FFFFFF" resizeMode="scaleAspectFit" />
        </Pressable>

        {/* bottom controls */}
        <View style={styles.bottom}>
          {frames.length === 0 && (
            <Text variant="body" style={styles.emptySub}>
              {undatedCount > 0
                ? `${pluralize(undatedCount, "visit")} with no date. Add dates to watch your map fill in.`
                : "Log some visits with dates to play a timelapse."}
            </Text>
          )}

          {atEnd && undatedCount > 0 && (
            <Text variant="body" style={styles.endNote}>plus {pluralize(undatedCount, "visit")} with no date</Text>
          )}

          {frames.length > 0 && (
            <View style={styles.controlsRow}>
              <Pressable onPress={atEnd ? replay : () => setPlaying((p) => !p)} hitSlop={12}>
                <SymbolView
                  name={atEnd ? "arrow.counterclockwise.circle.fill" : playing ? "pause.circle.fill" : "play.circle.fill"}
                  size={34}
                  tintColor={theme.visited}
                  resizeMode="scaleAspectFit"
                />
              </Pressable>
              <GestureDetector gesture={seek}>
                <View style={styles.barHit} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
                  <View style={styles.barTrack} />
                  <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: theme.visited }]} />
                  <View style={[styles.barThumb, { left: `${progress * 100}%`, backgroundColor: theme.visited }]} />
                </View>
              </GestureDetector>
            </View>
          )}

          {/* level switcher */}
          <View style={styles.levels}>
            <LevelChip label="World" active={level.kind === "world"} onPress={() => setLevel({ kind: "world" })} tc={tc} tint={theme.visited} />
            {[...continentSets.keys()].map((name) => (
              <LevelChip
                key={name}
                label={name}
                active={level.kind === "continent" && level.name === name}
                onPress={() => setLevel({ kind: "continent", name })}
                tc={tc}
                tint={theme.visited}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LevelChip({ label, active, onPress, tc, tint }: { label: string; active: boolean; onPress: () => void; tc: ThemeColors; tint: string }) {
  return (
    <Pressable onPress={onPress} style={[chipStyles.chip, { borderColor: active ? tint : "#333" }]}>
      <Text variant="body" style={{ color: active ? tint : "#BBB", fontSize: 13, fontWeight: active ? "700" : "500" }}>{label}</Text>
    </Pressable>
  );
}

const chipStyles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
});

const makeStyles = (_tc: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  top: { position: "absolute", top: 96, left: 0, right: 0, alignItems: "center", gap: 4 },
  date: { color: "#FFFFFF", fontSize: 30, fontWeight: "800", letterSpacing: 1 },
  counter: { color: "#FFFFFF", fontSize: 15 },
  continent: { color: "#00E08F", fontSize: 14, fontWeight: "700", marginTop: 2 },
  emptyTitle: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  close: { position: "absolute", right: 20 },
  bottom: { position: "absolute", left: 0, right: 0, bottom: 44, paddingHorizontal: spacing.lg, gap: spacing.md },
  emptySub: { color: "#BBB", textAlign: "center" },
  endNote: { color: "#BBB", textAlign: "center", fontSize: 13 },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  barHit: { flex: 1, height: 28, justifyContent: "center" },
  barTrack: { position: "absolute", left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: "#333" },
  barFill: { position: "absolute", left: 0, height: 4, borderRadius: 2 },
  barThumb: { position: "absolute", width: 16, height: 16, borderRadius: 8, marginLeft: -8, borderWidth: 2, borderColor: "#000" },
  levels: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
});
