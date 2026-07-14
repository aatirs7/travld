import { percentOfWorld, UN_COUNTRY_DENOMINATOR } from "@travld/core";
import { type ThemeColors, radius, spacing, Text, useLayout } from "@travld/ui";
import { useAppColors } from "@/lib/app-theme";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { CountryMap } from "@/components/CountryMap";
import { ExploreMapModal } from "@/components/ExploreMapModal";
import { HowToModal } from "@/components/HowToModal";
import { PassportMap } from "@/components/PassportMap";
import {
  api,
  normalizeName,
  type Admin1Map,
  type CountryDetail,
  type CountryRow,
} from "@/lib/api";
import { getFlag, setFlag } from "@/lib/local-flags";
import { useMapTheme } from "@/lib/map-theme-context";

const CONTINENTS = ["North America", "South America", "Europe", "Africa", "Asia", "Oceania"];

export default function MapScreen() {
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [unCount, setUnCount] = useState(0);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<View>(null);
  const [showMap, setShowMap] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [statPage, setStatPage] = useState(0);
  // country mode: when set, the home map becomes that country's states map
  const [country, setCountry] = useState<{ iso2: string; name: string } | null>(null);
  const [cDetail, setCDetail] = useState<CountryDetail | null>(null);
  const [cAdmin1, setCAdmin1] = useState<Admin1Map | null>(null);
  const { theme } = useMapTheme();
  const L = useLayout();
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);

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

  const nameByIso2 = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of countries) if (c.iso2) m.set(c.iso2, c.name);
    return m;
  }, [countries]);
  const placeIdByIso2 = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of countries) if (c.iso2) m.set(c.iso2, c.id);
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

  const onStatPage = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setStatPage(Math.round(e.nativeEvent.contentOffset.x / L.width));
    },
    [L.width],
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

  // ── country mode ──
  const openCountry = useCallback(async (iso2: string, name: string) => {
    setCountry({ iso2, name });
    setCDetail(null);
    setCAdmin1(null);
    const [d, m] = await Promise.all([
      api.getCountry(iso2),
      api.getAdmin1Map(iso2).catch(() => null),
    ]);
    setCDetail(d);
    setCAdmin1(m);
  }, []);

  const cVisitedNames = useMemo(
    () => new Set((cDetail?.regions ?? []).filter((r) => r.visited).map((r) => normalizeName(r.name))),
    [cDetail],
  );
  const cIdByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of cDetail?.regions ?? []) m.set(normalizeName(r.name), r.id);
    return m;
  }, [cDetail]);

  const toggleRegion = useCallback(
    async (regionId: number) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await api.togglePlace(regionId);
      if (country) api.getCountry(country.iso2).then(setCDetail).catch(() => {});
      void refreshVisited();
    },
    [country, refreshVisited],
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

  // Swipeable stat pages: World, then one per continent. Swiping focuses the map
  // to that continent and shows that continent's countries-visited stats.
  const statPages = useMemo(() => {
    const pages = [{
      key: "world",
      label: "WORLD",
      pct: percentOfWorld(unCount),
      frac: unCount / UN_COUNTRY_DENOMINATOR,
      visited: unCount,
      total: UN_COUNTRY_DENOMINATOR,
      focus: undefined as Set<string> | undefined,
    }];
    for (const cont of CONTINENTS) {
      const inCont = countries.filter((c) => c.iso2 && c.continent === cont);
      if (inCont.length === 0) continue;
      const isoSet = new Set(inCont.map((c) => c.iso2!));
      const total = inCont.filter((c) => c.isUnMember).length || inCont.length;
      const vis = [...visited].filter((iso) => isoSet.has(iso)).length;
      pages.push({
        key: cont,
        label: cont.toUpperCase(),
        pct: total ? Math.round((vis / total) * 100) : 0,
        frac: total ? vis / total : 0,
        visited: vis,
        total,
        focus: isoSet,
      });
    }
    return pages;
  }, [countries, visited, unCount]);
  const curStat = statPages[Math.min(statPage, statPages.length - 1)] ?? statPages[0]!;

  const visitedList = useMemo(
    () =>
      [...visited]
        .map((iso) => ({ iso, name: nameByIso2.get(iso) ?? iso }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [visited, nameByIso2],
  );
  const regionLabel = cDetail?.regions[0]?.displayType ?? "Regions";

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingTop: L.insets.top + spacing.sm, paddingBottom: L.scrollPadBottom, gap: L.sectionGap }}
        showsVerticalScrollIndicator={false}
      >
        {/* header row: left tool · centered logo · right actions */}
        <View style={[styles.actionRow, { paddingHorizontal: L.gutter }]}>
          <View style={styles.actionLeft}>
            <Pressable onPress={() => setShowMap(true)} hitSlop={12} style={styles.actionBtn}>
              <Text variant="hero" style={styles.actionIcon}>◎</Text>
            </Pressable>
          </View>
          <Image source={require("@/assets/images/travld-logo.png")} style={styles.logo} contentFit="contain" />
          <View style={styles.actionRight}>
            <Pressable onPress={() => setShowHelp(true)} hitSlop={12} style={styles.actionBtn}>
              <Text variant="hero" style={styles.actionIconDim}>?</Text>
            </Pressable>
            <Pressable onPress={() => setShowAdd(true)} hitSlop={12} style={styles.actionBtn}>
              <Text variant="hero" style={styles.actionIcon}>＋</Text>
            </Pressable>
          </View>
        </View>

        {error && <Text variant="body" style={styles.error}>{error}</Text>}

        {country ? (
          /* ── country mode: home map is a map of the selected country ── */
          <>
            <View style={styles.countryBar}>
              <Pressable onPress={() => setCountry(null)} hitSlop={12} style={styles.worldBack}>
                <Text variant="body" style={styles.worldBackText}>‹ World</Text>
              </Pressable>
              <Text variant="hero" style={styles.countryName} numberOfLines={1}>{country.name}</Text>
              <Pressable onPress={() => void handleToggle(country.iso2)} hitSlop={12} style={styles.visitedToggle}>
                <Text variant="body" style={[styles.visitedToggleText, visited.has(country.iso2) && styles.visitedToggleOn]}>
                  {visited.has(country.iso2) ? "Visited ✓" : "Mark"}
                </Text>
              </Pressable>
            </View>

            {cAdmin1 ? (
              <CountryMap map={cAdmin1} visitedNames={cVisitedNames} theme={theme}
                onRegionPress={(name) => {
                  const id = cIdByName.get(normalizeName(name));
                  if (id != null) void toggleRegion(id);
                }}
              />
            ) : (
              <View style={styles.mapLoading}><ActivityIndicator color={tc.mint} /></View>
            )}

            {cDetail && (
              <Text variant="hero" style={styles.pageLabel}>
                {cDetail.regionVisited} / {cDetail.regionTotal} {regionLabel.toUpperCase()}
              </Text>
            )}
            <Text variant="body" style={styles.hint}>Tap a {regionLabel.toLowerCase()} to mark it visited.</Text>

            <View style={{ paddingHorizontal: L.gutter }}>
              {(cDetail?.regions ?? []).map((r) => (
                <Pressable key={r.id} onPress={() => toggleRegion(r.id)} style={[styles.row, { minHeight: L.listRow }]}>
                  <View style={[styles.rowDot, { backgroundColor: r.visited ? theme.visited : tc.grey }]} />
                  <Text variant="body" numberOfLines={1} style={styles.rowText}>{r.name}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          /* ── world mode ── */
          <>
            <View ref={cardRef} collapsable={false} style={styles.shareCard}>
              <PassportMap
                visited={visited}
                onToggle={(iso) => openCountry(iso, nameByIso2.get(iso) ?? iso)}
                theme={theme}
                variant="world"
                focus={curStat.focus}
              />
              <Text variant="body" style={styles.pageLabel}>{curStat.label}</Text>

              {/* swipe the stat card to focus a continent */}
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onStatPage}
              >
                {statPages.map((sp) => (
                  <View key={sp.key} style={{ width: L.width }}>
                    <View style={[styles.statCard, { marginHorizontal: L.gutter }]}>
                      <View style={styles.statCol}>
                        <Text variant="hero" style={styles.statBig}>{sp.pct}%</Text>
                        <Text variant="hero" style={styles.statLabel}>{sp.label}</Text>
                      </View>
                      <Ring frac={sp.frac} color={theme.visited} />
                      <View style={styles.statCol}>
                        <Text variant="hero" style={styles.statBig}>{sp.visited}</Text>
                        <Text variant="hero" style={styles.statLabel}>COUNTRIES</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.dots}>
                {statPages.map((sp, i) => (
                  <View key={sp.key} style={[styles.dot, i === Math.min(statPage, statPages.length - 1) && styles.dotActive]} />
                ))}
              </View>
            </View>

            <Text variant="body" style={styles.statSub}>
              {statPage === 0
                ? `Out of ${UN_COUNTRY_DENOMINATOR} UN countries · swipe for continents`
                : `${curStat.visited} of ${curStat.total} in ${curStat.label.charAt(0) + curStat.label.slice(1).toLowerCase()}`}
            </Text>

            <Pressable style={styles.shareBtn} onPress={handleShare}>
              <Text variant="hero" style={styles.shareText}>Share</Text>
            </Pressable>

            <Text variant="hero" style={styles.sectionTitle}>My Countries</Text>
            {visitedList.length === 0 ? (
              <Text variant="body" style={styles.empty}>Tap a country on the map to open it — pinch to zoom. Mark it visited there or with ＋.</Text>
            ) : (
              <View style={{ paddingHorizontal: L.gutter }}>
                {visitedList.map(({ iso, name }) => (
                  <Pressable key={iso} onPress={() => openCountry(iso, name)} style={[styles.row, { minHeight: L.listRow }]}>
                    <View style={styles.rowDot} />
                    <Text variant="body" numberOfLines={1} style={styles.rowText}>{name}</Text>
                    <Text variant="body" style={styles.chevron}>›</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ExploreMapModal visible={showMap} onClose={() => setShowMap(false)} />
      <AddVisitSheet visible={showAdd} onClose={() => setShowAdd(false)} onSaved={refreshVisited} />
      <HowToModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </View>
  );
}

function Ring({ frac, color }: { frac: number; color: string }) {
  const tc = useAppColors();
  const size = 76;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, frac));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={tc.surfaceAlt} strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - p)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}

const makeStyles = (tc: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.bg },
  actionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actionLeft: { width: 80, flexDirection: "row" },
  actionRight: { flexDirection: "row", width: 80, justifyContent: "flex-end" },
  actionBtn: { width: 40, alignItems: "center" },
  actionIcon: { color: tc.mint, fontSize: 24 },
  actionIconDim: { color: tc.textDim, fontSize: 22, fontWeight: "700" },
  logo: { flex: 1, height: 44, marginHorizontal: spacing.sm },
  error: { color: "#FF6B6B", textAlign: "center", paddingHorizontal: spacing.md },
  shareCard: { backgroundColor: tc.bg, gap: spacing.sm },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: spacing.xs },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: tc.grey },
  dotActive: { backgroundColor: tc.mint, width: 20 },
  pageLabel: { color: tc.textDim, fontSize: 13, textAlign: "center", letterSpacing: 1 },
  hint: { color: tc.textDim, fontSize: 13, textAlign: "center", marginTop: -spacing.xs },
  statCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: tc.surface, borderRadius: radius.card,
    paddingVertical: spacing.lg, paddingHorizontal: spacing.lg, marginTop: spacing.sm,
  },
  statCol: { alignItems: "center", gap: 2, minWidth: 84 },
  statBig: { color: tc.mint, fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  statLabel: { color: tc.textDim, fontSize: 12, letterSpacing: 1 },
  statSub: { color: tc.textDim, fontSize: 13, textAlign: "center", marginTop: -spacing.xs },
  shareBtn: {
    alignSelf: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.pill, borderWidth: 1, borderColor: tc.mint,
  },
  shareText: { color: tc.mint, fontWeight: "600" },
  sectionTitle: { fontSize: 22, fontWeight: "700", color: tc.textPrimary, textAlign: "center" },
  empty: { color: tc.textDim, textAlign: "center", paddingHorizontal: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tc.mint },
  rowText: { color: tc.textPrimary, fontSize: 16, flex: 1, textAlign: "center" },
  chevron: { color: tc.textDim, fontSize: 22 },
  countryBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md },
  worldBack: { width: 72 },
  worldBackText: { color: tc.mint, fontSize: 17, fontWeight: "600" },
  visitedToggle: { width: 72, alignItems: "flex-end" },
  visitedToggleText: { color: tc.textDim, fontSize: 15, fontWeight: "600" },
  visitedToggleOn: { color: tc.mint },
  countryName: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "700", color: tc.textPrimary },
  mapLoading: { height: 200, alignItems: "center", justifyContent: "center" },
});
