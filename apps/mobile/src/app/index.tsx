import { percentOfWorld, UN_COUNTRY_DENOMINATOR } from "@travld/core";
import { colors, radius, spacing, Text, useLayout } from "@travld/ui";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { captureRef } from "react-native-view-shot";
import { AddVisitSheet } from "@/components/AddVisitSheet";
import { CountryDetailSheet } from "@/components/CountryDetailSheet";
import { ExploreMapModal } from "@/components/ExploreMapModal";
import { HowToModal } from "@/components/HowToModal";
import { PassportMap } from "@/components/PassportMap";
import { api, type CountryRow, type RegionProgress } from "@/lib/api";
import { getFlag, setFlag } from "@/lib/local-flags";
import { useMapTheme } from "@/lib/map-theme-context";

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
  const [page, setPage] = useState(0); // 0 = World, 1 = Regions
  const [regionProgress, setRegionProgress] = useState<RegionProgress | null>(null);
  const { theme } = useMapTheme();
  const L = useLayout();

  const refreshVisited = useCallback(async () => {
    const v = await api.getVisited();
    setVisited(new Set(v.visitedIso2));
    setUnCount(v.unCount);
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      if (!loading) void refreshVisited();
    }, [loading, refreshVisited]),
  );

  const onPage = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const p = Math.round(e.nativeEvent.contentOffset.x / L.width);
      setPage(p);
      if (p === 1 && !regionProgress) {
        api.getRegionProgress().then((r) => setRegionProgress(r.progress)).catch(() => {});
      }
    },
    [L.width, regionProgress],
  );

  const handleToggle = useCallback(
    async (iso2: string) => {
      const placeId = placeIdByIso2.get(iso2);
      if (placeId == null) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      /* cancelled */
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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          paddingTop: L.insets.top + spacing.sm,
          paddingBottom: L.scrollPadBottom,
          gap: L.sectionGap,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* header */}
        <View style={[styles.header, { paddingHorizontal: L.gutter }]}>
          <View style={styles.headerSide}>
            <Pressable onPress={() => setShowMap(true)} hitSlop={12} style={styles.headerBtn}>
              <Text variant="hero" style={styles.headerIcon}>◎</Text>
            </Pressable>
          </View>
          <View style={styles.wordmarkWrap}>
            <Image
              source={require("@/assets/images/travld-logo.png")}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            <Pressable onPress={() => setShowHelp(true)} hitSlop={12} style={styles.headerBtn}>
              <Text variant="hero" style={styles.headerIconDim}>?</Text>
            </Pressable>
            <Pressable onPress={() => setShowAdd(true)} hitSlop={12} style={styles.headerBtn}>
              <Text variant="hero" style={styles.headerIcon}>＋</Text>
            </Pressable>
          </View>
        </View>

        {error && <Text variant="body" style={styles.error}>{error}</Text>}

        {/* shareable card: swipeable map + stat card */}
        <View ref={cardRef} collapsable={false} style={styles.shareCard}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPage}
          >
            <View style={{ width: L.width }}>
              <PassportMap visited={visited} onToggle={handleToggle} theme={theme} variant="world" />
            </View>
            <View style={{ width: L.width }}>
              <PassportMap
                visited={visited}
                theme={theme}
                variant="heatmap"
                regionProgress={regionProgress ?? undefined}
              />
            </View>
          </ScrollView>

          <View style={styles.dots}>
            {["World", "Regions"].map((label, i) => (
              <View key={label} style={styles.dotWrap}>
                <View style={[styles.dot, i === page && styles.dotActive]} />
              </View>
            ))}
          </View>
          <Text variant="body" style={styles.pageLabel}>{page === 0 ? "World" : "Regions"}</Text>

          {/* Been-style stat card */}
          <View style={[styles.statCard, { marginHorizontal: L.gutter }]}>
            <View style={styles.statCol}>
              <Text variant="hero" style={styles.statBig}>{pct}%</Text>
              <Text variant="hero" style={styles.statLabel}>WORLD</Text>
            </View>
            <Ring frac={unCount / UN_COUNTRY_DENOMINATOR} color={theme.visited} />
            <View style={styles.statCol}>
              <Text variant="hero" style={styles.statBig}>{unCount}</Text>
              <Text variant="hero" style={styles.statLabel}>COUNTRIES</Text>
            </View>
          </View>
        </View>

        <Text variant="body" style={styles.statSub}>Out of {UN_COUNTRY_DENOMINATOR} UN countries</Text>

        <Pressable style={[styles.shareBtn, { marginHorizontal: L.gutter }]} onPress={handleShare}>
          <Text variant="hero" style={styles.shareText}>Share</Text>
        </Pressable>

        {/* quick-jump country strip → open a country's states/cities/stats */}
        {visitedList.length > 0 && (
          <View>
            <Text variant="hero" style={[styles.sectionTitle, { paddingHorizontal: L.gutter }]}>
              My Countries
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: L.gutter, gap: spacing.sm, paddingTop: spacing.sm }}
            >
              {visitedList.map(({ iso, name }) => (
                <Pressable key={iso} onPress={() => setSelectedIso2(iso)} style={styles.countryChip}>
                  <Text variant="body" style={styles.countryChipText}>{name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* full list */}
        <View style={{ paddingHorizontal: L.gutter }}>
          {visitedList.length === 0 ? (
            <Text variant="body" style={styles.empty}>
              Tap a country on the map to mark it visited.
            </Text>
          ) : (
            visitedList.map(({ iso, name }) => (
              <Pressable
                key={iso}
                onPress={() => setSelectedIso2(iso)}
                style={[styles.row, { minHeight: L.listRow }]}
              >
                <View style={styles.rowDot} />
                <Text variant="body" numberOfLines={1} ellipsizeMode="tail" style={styles.rowText}>
                  {name}
                </Text>
                <Text variant="body" style={styles.chevron}>›</Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <CountryDetailSheet iso2={selectedIso2} onClose={() => setSelectedIso2(null)} onChanged={refreshVisited} />
      <ExploreMapModal visible={showMap} onClose={() => setShowMap(false)} />
      <AddVisitSheet visible={showAdd} onClose={() => setShowAdd(false)} onSaved={refreshVisited} />
      <HowToModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
}

function Ring({ frac, color }: { frac: number; color: string }) {
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, frac));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - p)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center" },
  headerSide: { width: 84, flexDirection: "row", alignItems: "center" },
  headerSideRight: { justifyContent: "flex-end" },
  headerBtn: { width: 40, alignItems: "center" },
  headerIcon: { color: colors.mint, fontSize: 24 },
  headerIconDim: { color: colors.textDim, fontSize: 22, fontWeight: "700" },
  wordmarkWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { width: 150, height: 48 },
  error: { color: "#FF6B6B", textAlign: "center", paddingHorizontal: spacing.md },
  shareCard: { backgroundColor: colors.bg, gap: spacing.sm },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: spacing.xs },
  dotWrap: {},
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.grey },
  dotActive: { backgroundColor: colors.mint, width: 20 },
  pageLabel: { color: colors.textDim, fontSize: 13, textAlign: "center", textTransform: "uppercase", letterSpacing: 1 },
  statCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  statCol: { alignItems: "center", gap: 2, minWidth: 84 },
  statBig: { color: colors.mint, fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  statLabel: { color: colors.textDim, fontSize: 12, letterSpacing: 1 },
  statSub: { color: colors.textDim, fontSize: 13, textAlign: "center", marginTop: -spacing.xs },
  shareBtn: {
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.mint,
  },
  shareText: { color: colors.mint, fontWeight: "600" },
  sectionTitle: { fontSize: 22, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
  countryChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  countryChipText: { color: colors.textPrimary, fontSize: 14 },
  empty: { color: colors.textDim, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint },
  rowText: { color: colors.textPrimary, fontSize: 16, flex: 1, textAlign: "center" },
  chevron: { color: colors.textDim, fontSize: 22 },
});
