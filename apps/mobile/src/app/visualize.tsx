import { colors, radius, spacing, Text, useLayout } from "@travld/ui";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Circle, G, Rect } from "react-native-svg";
import { api } from "@/lib/api";
import { useMapTheme } from "@/lib/map-theme-context";

interface Stats {
  totals: { countries: number; regions: number; cities: number };
  continents: { continent: string; countries: number }[];
  purposes: { purpose: string; count: number }[];
  timeline: { year: number; count: number }[];
  distanceKm: number;
}

const PURPOSE_COLORS: Record<string, string> = {
  leisure: "#00E08F",
  lived: "#4EA8FF",
  work: "#B18CFF",
  transit: "#FF9F0A",
  layover: "#FF5D8F",
};

export default function VisualizeScreen() {
  const L = useLayout();
  const { theme } = useMapTheme();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (api.getStats() as Promise<Stats>).then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.mint} />
      </View>
    );
  }

  const maxContinent = Math.max(1, ...stats.continents.map((c) => c.countries));
  const maxYear = Math.max(1, ...stats.timeline.map((t) => t.count));

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: L.gutter,
          paddingTop: L.insets.top + spacing.sm,
          paddingBottom: L.scrollPadBottom,
          gap: L.sectionGap,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="hero" style={styles.h1}>
          Visualize
        </Text>

        {/* stat tiles */}
        <View style={styles.tiles}>
          <Tile value={stats.totals.countries} label="Countries" />
          <Tile value={stats.totals.cities} label="Cities" />
          <Tile value={formatKm(stats.distanceKm)} label="From home" />
        </View>

        {/* continent bars */}
        <Text variant="hero" style={styles.section}>By continent</Text>
        <View style={{ gap: spacing.sm }}>
          {stats.continents.map((c) => (
            <View key={c.continent} style={styles.barRow}>
              <Text variant="body" numberOfLines={1} style={styles.barLabel}>{c.continent}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${(c.countries / maxContinent) * 100}%`, backgroundColor: theme.visited }]} />
              </View>
              <Text variant="body" style={styles.barValue}>{c.countries}</Text>
            </View>
          ))}
        </View>

        {/* purpose donut */}
        <Text variant="hero" style={styles.section}>By purpose</Text>
        <View style={styles.donutRow}>
          <Donut data={stats.purposes} />
          <View style={styles.donutLegend}>
            {stats.purposes.map((p) => (
              <View key={p.purpose} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: PURPOSE_COLORS[p.purpose] ?? colors.grey }]} />
                <Text variant="body" style={styles.legendText}>{cap(p.purpose)} · {p.count}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* timeline */}
        <Text variant="hero" style={styles.section}>Timeline</Text>
        {stats.timeline.length === 0 ? (
          <Text variant="body" style={styles.dim}>Add dated visits to see your timeline.</Text>
        ) : (
          <View style={styles.timeline}>
            {stats.timeline.map((t) => (
              <View key={t.year} style={styles.tlCol}>
                <View style={[styles.tlBar, { height: 8 + (t.count / maxYear) * 120, backgroundColor: theme.visited }]} />
                <Text variant="body" style={styles.tlYear}>{`'${String(t.year).slice(2)}`}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Tile({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.tile}>
      <Text variant="hero" style={styles.tileValue}>{value}</Text>
      <Text variant="hero" style={styles.tileLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function Donut({ data }: { data: { purpose: string; count: number }[] }) {
  const size = 120;
  const stroke = 22;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  let offset = 0;
  const segments = data.map((d) => {
    const frac = d.count / total;
    const seg = { color: PURPOSE_COLORS[d.purpose] ?? colors.grey, dash: frac * c, gap: c - frac * c, offset: -offset };
    offset += frac * c;
    return seg;
  });
  return (
    <Svg width={size} height={size}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        {segments.map((s, i) => (
          <Circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={s.offset}
          />
        ))}
      </G>
    </Svg>
  );
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
function formatKm(km: number) {
  if (km >= 1000) return `${Math.round(km / 1000)}k km`;
  return `${km} km`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  h1: { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  section: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  tiles: { flexDirection: "row", gap: spacing.sm },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.md, alignItems: "center", gap: spacing.xs },
  tileValue: { color: colors.mint, fontSize: 28, fontWeight: "700" },
  tileLabel: { color: colors.textDim, fontSize: 11, letterSpacing: 0.5 },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  barLabel: { color: colors.textPrimary, fontSize: 14, width: 96 },
  barTrack: { flex: 1, height: 12, backgroundColor: colors.surfaceAlt, borderRadius: 6, overflow: "hidden" },
  barFill: { height: 12, borderRadius: 6 },
  barValue: { color: colors.textDim, fontSize: 13, width: 28, textAlign: "right" },
  donutRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  donutLegend: { flex: 1, gap: spacing.xs },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { color: colors.textPrimary, fontSize: 14 },
  timeline: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, minHeight: 150 },
  tlCol: { alignItems: "center", gap: spacing.xs, flex: 1 },
  tlBar: { width: 18, borderRadius: 4 },
  tlYear: { color: colors.textDim, fontSize: 12 },
  dim: { color: colors.textDim },
});
