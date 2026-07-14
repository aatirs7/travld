import { percentOfWorld, UN_COUNTRY_DENOMINATOR } from "@travld/core";
import { colors, radius, spacing, Text, useLayout } from "@travld/ui";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { AddVisitSheet } from "@/components/AddVisitSheet";
import { CountryDetailSheet } from "@/components/CountryDetailSheet";
import { ExploreMapModal } from "@/components/ExploreMapModal";
import { HowToModal } from "@/components/HowToModal";
import { PassportMap } from "@/components/PassportMap";
import { api, type CountryRow, type RegionProgress } from "@/lib/api";
import { getFlag, setFlag } from "@/lib/local-flags";
import { useMapTheme } from "@/lib/map-theme-context";

type MapVariant = "world" | "heatmap";

export default function MapScreen() {
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [unCount, setUnCount] = useState(0);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<View>(null);
  const [selectedIso2, setSelectedIso2] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [mapVariant, setMapVariant] = useState<MapVariant>("world");
  const [regionProgress, setRegionProgress] = useState<RegionProgress | null>(null);
  const { theme } = useMapTheme();
  const L = useLayout();

  const showVariant = useCallback(async (v: MapVariant) => {
    setMapVariant(v);
    if (v === "heatmap" && !regionProgress) {
      try {
        const { progress } = await api.getRegionProgress();
        setRegionProgress(progress);
      } catch {
        /* keep world */
      }
    }
  }, [regionProgress]);

  const refreshVisited = useCallback(async () => {
    const v = await api.getVisited();
    setVisited(new Set(v.visitedIso2));
    setUnCount(v.unCount);
  }, []);

  // show the how-to once, on first launch
  useEffect(() => {
    if (!getFlag("seenHowTo")) {
      setShowHelp(true);
      setFlag("seenHowTo", true);
    }
  }, []);

  const placeIdByIso2 = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of countries) if (c.iso2) m.set(c.iso2, c.id);
    return m;
  }, [countries]);

  const nameByIso2 = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of countries) if (c.iso2) m.set(c.iso2, c.name);
    return m;
  }, [countries]);

  useEffect(() => {
    (async () => {
      try {
        const [v, c] = await Promise.all([api.getVisited(), api.listCountries()]);
        setVisited(new Set(v.visitedIso2));
        setUnCount(v.unCount);
        setCountries(c.countries);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // refresh derived counts when returning to the tab (e.g. after a layover-rule change)
  useFocusEffect(
    useCallback(() => {
      if (!loading) void refreshVisited();
    }, [loading, refreshVisited]),
  );

  const handleToggle = useCallback(
    async (iso2: string) => {
      const placeId = placeIdByIso2.get(iso2);
      if (placeId == null) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // non-negotiable
      try {
        const res = await api.toggleCountry(placeId);
        setVisited(new Set(res.summary.visitedIso2));
        setUnCount(res.summary.unCount);
      } catch {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [placeIdByIso2],
  );

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {
      /* cancelled or capture failed */
    }
  }, []);

  const pct = percentOfWorld(unCount);
  const visitedList = useMemo(
    () =>
      [...visited]
        .map((iso) => ({ iso, name: nameByIso2.get(iso) ?? iso }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [visited, nameByIso2],
  );

  // NB: never gate the whole screen on the API. The passport map is a local
  // asset and must render immediately (grey world) even offline / before the
  // backend responds; visited fills + counts populate once data loads.
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
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <Pressable onPress={() => setShowMap(true)} hitSlop={12} style={styles.headerBtn}>
              <Text variant="hero" style={styles.headerIcon}>◎</Text>
            </Pressable>
          </View>
          <Text variant="hero" style={styles.wordmark}>
            travld
          </Text>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            <Pressable onPress={() => setShowHelp(true)} hitSlop={12} style={styles.headerBtn}>
              <Text variant="hero" style={styles.headerIconDim}>?</Text>
            </Pressable>
            <Pressable onPress={() => setShowAdd(true)} hitSlop={12} style={styles.headerBtn}>
              <Text variant="hero" style={styles.headerIcon}>＋</Text>
            </Pressable>
          </View>
        </View>

        {error && (
          <Text variant="body" style={styles.error}>
            {error}
          </Text>
        )}

        {/* map variant switcher (outside the shareable card) */}
        <View style={styles.variants}>
          {(["world", "heatmap"] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => showVariant(v)}
              style={[styles.variantChip, mapVariant === v && styles.variantChipActive]}
            >
              <Text variant="body" style={[styles.variantText, mapVariant === v && styles.variantTextActive]}>
                {v === "world" ? "World" : "Regions"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Shareable card: map + hero number */}
        <View ref={cardRef} collapsable={false} style={styles.card}>
          <PassportMap
            visited={visited}
            onToggle={mapVariant === "world" ? handleToggle : undefined}
            theme={theme}
            variant={mapVariant}
            regionProgress={regionProgress ?? undefined}
          />
          <View style={styles.hero}>
            <View style={styles.heroNumberRow}>
              <Text variant="hero" style={[styles.number, { fontSize: L.heroNumber }]}>
                {unCount}
              </Text>
              <Text variant="hero" style={styles.pct}>
                {pct}%
              </Text>
            </View>
            <Text variant="hero" style={[styles.label, { fontSize: L.heroLabel }]}>
              COUNTRIES · {unCount} / {UN_COUNTRY_DENOMINATOR}
            </Text>
          </View>
        </View>

        <Pressable style={styles.shareBtn} onPress={handleShare}>
          <Text variant="hero" style={styles.shareText}>
            Share
          </Text>
        </Pressable>

        <Text variant="hero" style={styles.sectionTitle}>
          My Countries
        </Text>
        {visitedList.length === 0 ? (
          <Text variant="body" style={styles.empty}>
            Tap a country on the map to mark it visited.
          </Text>
        ) : (
          <View style={styles.list}>
            {visitedList.map(({ iso, name }) => (
              <Pressable
                key={iso}
                onPress={() => setSelectedIso2(iso)}
                style={[styles.row, { minHeight: L.listRow }]}
              >
                <View style={styles.dot} />
                <Text variant="body" numberOfLines={1} ellipsizeMode="tail" style={styles.rowText}>
                  {name}
                </Text>
                <Text variant="body" style={styles.chevron}>
                  ›
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <CountryDetailSheet
        iso2={selectedIso2}
        onClose={() => setSelectedIso2(null)}
        onChanged={refreshVisited}
      />
      <ExploreMapModal visible={showMap} onClose={() => setShowMap(false)} />
      <AddVisitSheet visible={showAdd} onClose={() => setShowAdd(false)} onSaved={refreshVisited} />
      <HowToModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center" },
  headerSide: { width: 84, flexDirection: "row", alignItems: "center" },
  headerSideRight: { justifyContent: "flex-end" },
  headerBtn: { width: 40, alignItems: "center" },
  headerIcon: { color: colors.mint, fontSize: 24 },
  headerIconDim: { color: colors.textDim, fontSize: 22, fontWeight: "700" },
  wordmark: {
    color: colors.mint,
    fontSize: 22,
    fontWeight: "200",
    letterSpacing: 6,
    textAlign: "center",
    flex: 1,
  },
  error: { color: "#FF6B6B", textAlign: "center" },
  card: { backgroundColor: colors.bg, gap: spacing.md },
  hero: { alignItems: "center", gap: spacing.xs },
  heroNumberRow: { flexDirection: "row", alignItems: "flex-start" },
  number: { fontWeight: "700", color: colors.mint, letterSpacing: -1 },
  pct: { fontSize: 20, color: colors.mint, marginTop: spacing.sm, marginLeft: spacing.xs },
  label: { color: colors.textDim, letterSpacing: 0.5, textTransform: "uppercase" },
  shareBtn: {
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.mint,
  },
  shareText: { color: colors.mint, fontWeight: "600" },
  sectionTitle: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  empty: { color: colors.textDim },
  list: { gap: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint },
  rowText: { color: colors.textPrimary, fontSize: 16, flex: 1 },
  chevron: { color: colors.textDim, fontSize: 22 },
  variants: { flexDirection: "row", gap: spacing.sm, alignSelf: "center" },
  variantChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  variantChipActive: { backgroundColor: colors.surfaceAlt },
  variantText: { color: colors.textDim, fontSize: 14 },
  variantTextActive: { color: colors.textPrimary, fontWeight: "600" },
});
