import {
  earliestVisitYear,
  percentOfWorld,
  plural,
  visitedIsoAsOf,
  UN_COUNTRY_DENOMINATOR,
  type EnrichedVisit,
} from "@travld/core";
import { PassportStrip, type ThemeColors, radius, spacing, Text, useLayout } from "@travld/ui";
import { useAppColors, useAppTheme } from "@/lib/app-theme";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import * as Haptics from "expo-haptics";
import { SymbolView } from "expo-symbols";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { AddVisitSheet } from "@/components/AddVisitSheet";
import { CountryMap } from "@/components/CountryMap";
import { ExploreMapModal } from "@/components/ExploreMapModal";
import { HowToModal } from "@/components/HowToModal";
import { PassportMap } from "@/components/PassportMap";
import { TimelapseModal } from "@/components/TimelapseModal";
import { YearScrubber } from "@/components/YearScrubber";
import {
  api,
  normalizeName,
  type Admin1Map,
  type CountryDetail,
  type CountryRow,
} from "@/lib/api";
import { getCache, getFlag, setCache, setFlag } from "@/lib/local-flags";
import { useMapTheme } from "@/lib/map-theme-context";

const CONTINENTS = ["North America", "South America", "Europe", "Africa", "Asia", "Oceania"];

type RegionProgress = Record<string, { total: number; visited: number }>;
type MapView = { kind: "world" } | { kind: "continent"; name: string } | { kind: "heatmap" };

export default function MapScreen() {
  const cachedVisited = getCache<{ visitedIso2: string[]; unCount: number }>("visited");
  const cachedCountries = getCache<CountryRow[]>("countries");
  const [visited, setVisited] = useState<Set<string>>(new Set(cachedVisited?.visitedIso2 ?? []));
  const [unCount, setUnCount] = useState(cachedVisited?.unCount ?? 0);
  const [countries, setCountries] = useState<CountryRow[]>(cachedCountries ?? []);
  const [loading, setLoading] = useState(!cachedCountries);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<View>(null);
  const [showMap, setShowMap] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showTimelapse, setShowTimelapse] = useState(false);
  const [mapView, setMapView] = useState<MapView>({ kind: "world" });
  const [showVariants, setShowVariants] = useState(false);
  const [regionProgress, setRegionProgress] = useState<RegionProgress | undefined>(
    getCache<RegionProgress>("regionProgress") ?? undefined,
  );
  const [userVisits, setUserVisits] = useState<EnrichedVisit[]>(getCache<EnrichedVisit[]>("visits:me") ?? []);
  const nowYear = useMemo(() => new Date().getFullYear(), []);
  const [scrubYear, setScrubYear] = useState<number>(nowYear);
  // country mode: when set, the home map becomes that country's states map
  const [country, setCountry] = useState<{ iso2: string; name: string } | null>(null);
  const [cDetail, setCDetail] = useState<CountryDetail | null>(null);
  const [cAdmin1, setCAdmin1] = useState<Admin1Map | null>(null);
  const { theme } = useMapTheme();
  const L = useLayout();
  const tc = useAppColors();
  const { mode, setMode } = useAppTheme();
  const styles = useMemo(() => makeStyles(tc), [tc]);
  const snapPoints = useMemo(() => ["34%", "62%", "92%"], []);

  const refreshVisited = useCallback(async () => {
    const v = await api.getVisited();
    setVisited(new Set(v.visitedIso2));
    setUnCount(v.unCount);
    setCache("visited", { visitedIso2: v.visitedIso2, unCount: v.unCount });
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
        setCache("visited", { visitedIso2: v.visitedIso2, unCount: v.unCount });
        setCache("countries", c.countries);
      } catch (e) {
        if (!cachedCountries) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    api.getUserVisits().then(setUserVisits).catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        void refreshVisited();
        api.getUserVisits().then(setUserVisits).catch(() => {});
      }
    }, [loading, refreshVisited]),
  );

  // Region-completion heatmap needs per-country admin-1 counts — fetch lazily the
  // first time the user switches to that variant.
  useEffect(() => {
    if (mapView.kind === "heatmap" && !regionProgress) {
      api.getRegionProgress()
        .then((r) => { setRegionProgress(r.progress); setCache("regionProgress", r.progress); })
        .catch(() => {});
    }
  }, [mapView, regionProgress]);

  const handleToggle = useCallback(
    async (iso2: string) => {
      const placeId = placeIdByIso2.get(iso2);
      if (placeId == null) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      try {
        const res = await api.toggleCountry(placeId);
        setVisited(new Set(res.summary.visitedIso2));
        setUnCount(res.summary.unCount);
        setCache("visited", { visitedIso2: res.summary.visitedIso2, unCount: res.summary.unCount });
      } catch {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [placeIdByIso2],
  );

  // ── country mode ──
  const openCountry = useCallback(async (iso2: string, name: string) => {
    setCountry({ iso2, name });
    setCDetail(getCache<CountryDetail>(`country:${iso2}`));
    setCAdmin1(getCache<Admin1Map>(`admin1:${iso2}`));
    const [d, m] = await Promise.all([
      api.getCountry(iso2),
      api.getAdmin1Map(iso2).catch(() => null),
    ]);
    setCDetail(d);
    setCAdmin1(m);
    setCache(`country:${iso2}`, d);
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
      if (country) {
        api.getCountry(country.iso2).then((d) => {
          setCDetail(d);
          setCache(`country:${country.iso2}`, d);
        }).catch(() => {});
      }
      void refreshVisited();
    },
    [country, refreshVisited],
  );

  const handleShare = useCallback(async () => {
    if (!mapRef.current) return;
    try {
      const uri = await captureRef(mapRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch {
      /* cancelled */
    }
  }, []);

  // Continent iso-sets + UN totals, used by continent focus and its stats.
  const continentSets = useMemo(() => {
    const m = new Map<string, { iso: Set<string>; total: number }>();
    for (const cont of CONTINENTS) {
      const inCont = countries.filter((c) => c.iso2 && c.continent === cont);
      if (inCont.length === 0) continue;
      const iso = new Set(inCont.map((c) => c.iso2!));
      const total = inCont.filter((c) => c.isUnMember).length || inCont.length;
      m.set(cont, { iso, total });
    }
    return m;
  }, [countries]);

  const continentByIso = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of countries) if (c.iso2 && c.continent) m[c.iso2] = c.continent;
    return m;
  }, [countries]);

  // Year scrubber: derive the visited set "as of" the selected year. Far-right
  // (scrubYear >= nowYear) is all time and uses the authoritative server set.
  const minYear = useMemo(() => earliestVisitYear(userVisits), [userVisits]);
  const hasScrubber = !country && minYear != null && minYear < nowYear;
  const scrubbing = hasScrubber && scrubYear < nowYear;
  const unMemberSet = useMemo(
    () => new Set(countries.filter((c) => c.iso2 && c.isUnMember).map((c) => c.iso2!)),
    [countries],
  );
  const effVisited = useMemo(
    () => (scrubbing ? visitedIsoAsOf(userVisits, scrubYear) : visited),
    [scrubbing, userVisits, scrubYear, visited],
  );
  const effUnCount = useMemo(
    () => (scrubbing ? [...effVisited].filter((i) => unMemberSet.has(i)).length : unCount),
    [scrubbing, effVisited, unMemberSet, unCount],
  );

  // Stats + framing for whatever map view is active.
  const view = useMemo(() => {
    if (mapView.kind === "continent") {
      const cs = continentSets.get(mapView.name);
      if (cs) {
        const vis = [...effVisited].filter((i) => cs.iso.has(i)).length;
        return { label: mapView.name, visited: vis, total: cs.total, focus: cs.iso, variant: "world" as const };
      }
    }
    if (mapView.kind === "heatmap") {
      return { label: "Region heatmap", visited: effUnCount, total: UN_COUNTRY_DENOMINATOR, focus: undefined, variant: "heatmap" as const };
    }
    return { label: "World", visited: effUnCount, total: UN_COUNTRY_DENOMINATOR, focus: undefined, variant: "world" as const };
  }, [mapView, continentSets, effVisited, effUnCount]);
  const pct = mapView.kind === "world" ? percentOfWorld(view.visited) : view.total ? Math.round((view.visited / view.total) * 100) : 0;

  const visitedList = useMemo(
    () =>
      [...visited]
        .map((iso) => ({ iso, name: nameByIso2.get(iso) ?? iso }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [visited, nameByIso2],
  );
  const regionLabel = cDetail?.regions[0]?.displayType ?? "Regions";

  const pickVariant = useCallback((mv: MapView) => {
    void Haptics.selectionAsync();
    setMapView(mv);
    setShowVariants(false);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style={mode === "light" ? "dark" : "light"} />

      {/* ── full-bleed map layer ── */}
      <View ref={mapRef} collapsable={false} style={StyleSheet.absoluteFill}>
        {country ? (
          <View style={styles.countryMapWrap}>
            {cAdmin1 ? (
              <CountryMap
                map={cAdmin1}
                visitedNames={cVisitedNames}
                theme={theme}
                onRegionPress={(name) => {
                  const id = cIdByName.get(normalizeName(name));
                  if (id != null) void toggleRegion(id);
                }}
              />
            ) : (
              <ActivityIndicator color={tc.mint} />
            )}
          </View>
        ) : (
          <PassportMap
            fill
            visited={effVisited}
            onToggle={(iso) => openCountry(iso, nameByIso2.get(iso) ?? iso)}
            onLongPress={() => setShowVariants(true)}
            theme={theme}
            variant={view.variant}
            regionProgress={regionProgress}
            focus={view.focus}
          />
        )}
      </View>

      {/* ── floating header over the map ── */}
      <View style={[styles.header, { paddingTop: L.insets.top + spacing.xs, paddingHorizontal: L.gutter }]}>
        <View style={styles.headerSide}>
          <Pressable onPress={() => setShowMap(true)} hitSlop={12} style={styles.iconBtn}>
            <SymbolView name="globe" size={22} tintColor={tc.mint} resizeMode="scaleAspectFit" />
          </Pressable>
          <Pressable onPress={() => setMode(mode === "light" ? "dark" : "light")} hitSlop={12} style={styles.iconBtn}>
            <SymbolView name={mode === "light" ? "moon.fill" : "sun.max.fill"} size={22} tintColor={tc.mint} resizeMode="scaleAspectFit" />
          </Pressable>
        </View>
        <SymbolView name="mappin.circle.fill" size={30} tintColor={tc.mint} resizeMode="scaleAspectFit" />
        <View style={[styles.headerSide, styles.headerRight]}>
          <Pressable onPress={() => setShowTimelapse(true)} hitSlop={12} style={styles.iconBtn}>
            <SymbolView name="play.circle.fill" size={24} tintColor={tc.mint} resizeMode="scaleAspectFit" />
          </Pressable>
          <Pressable onPress={() => setShowHelp(true)} hitSlop={12} style={styles.iconBtn}>
            <SymbolView name="questionmark.circle" size={22} tintColor={tc.textDim} resizeMode="scaleAspectFit" />
          </Pressable>
          <Pressable onPress={() => setShowAdd(true)} hitSlop={12} style={styles.iconBtn}>
            <SymbolView name="plus.circle.fill" size={24} tintColor={tc.mint} resizeMode="scaleAspectFit" />
          </Pressable>
        </View>
      </View>

      {error && (
        <View style={[styles.errorWrap, { top: L.insets.top + 52 }]}>
          <Text variant="body" style={styles.error}>{error}</Text>
        </View>
      )}

      {/* ── year scrubber: floats over the map, just above the sheet ── */}
      {hasScrubber && minYear != null && (
        <View style={[styles.scrubberWrap, { bottom: Math.round(L.height * 0.34) + 10, left: L.gutter, right: L.gutter }]}>
          <YearScrubber
            minYear={minYear}
            maxYear={nowYear}
            year={scrubYear}
            onChange={setScrubYear}
            colors={tc}
            tint={theme.visited}
          />
        </View>
      )}

      {/* ── floating sheet ── */}
      <BottomSheet
        index={1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: tc.surface }}
        handleIndicatorStyle={{ backgroundColor: tc.grey }}
      >
        <BottomSheetScrollView
          contentContainerStyle={{ paddingHorizontal: L.gutter, paddingBottom: L.scrollPadBottom, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          {country ? (
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

              {cDetail && (
                <>
                  <View style={styles.statRow}>
                    <Text variant="hero" mono style={styles.statCount}>
                      {cDetail.regionVisited}
                      <Text variant="hero" style={styles.statTotal}> / {cDetail.regionTotal}</Text>
                    </Text>
                    <Text variant="hero" mono style={styles.statPct}>
                      {cDetail.regionTotal ? Math.round((cDetail.regionVisited / cDetail.regionTotal) * 100) : 0}%
                    </Text>
                  </View>
                  <Text variant="body" style={styles.statLabel}>{regionLabel.toLowerCase()}</Text>
                  <PassportStrip units={cDetail.regionTotal} filled={cDetail.regionVisited} colors={tc} visitedColor={theme.visited} />
                </>
              )}
              <Text variant="body" style={styles.hint}>Tap a {regionLabel.toLowerCase()} on the map, or a row below, to mark it visited.</Text>

              {(cDetail?.regions ?? []).map((r) => (
                <Pressable key={r.id} onPress={() => toggleRegion(r.id)} style={[styles.row, { minHeight: L.listRow }]}>
                  <View style={[styles.rowDot, { backgroundColor: r.visited ? theme.visited : tc.grey }]} />
                  <Text variant="body" numberOfLines={1} style={styles.rowText}>{r.name}</Text>
                </Pressable>
              ))}
            </>
          ) : (
            <>
              {/* stat header: count leads white, percent trails mint mono */}
              <View style={styles.statRow}>
                <View style={styles.statCountWrap}>
                  <Text variant="hero" mono style={styles.statCount} numberOfLines={1} adjustsFontSizeToFit>
                    {view.visited}
                  </Text>
                  <Text variant="body" style={styles.statLabel}>{plural(view.visited, "country", "countries")}</Text>
                </View>
                <Text variant="hero" mono style={styles.statPct}>{pct}%</Text>
              </View>

              <PassportStrip units={view.total} filled={view.visited} colors={tc} visitedColor={theme.visited} />

              <View style={styles.subRow}>
                <Text variant="body" style={styles.statSub}>
                  {view.visited} of {view.total} · {view.label}
                </Text>
                <Pressable onPress={() => setShowVariants(true)} hitSlop={8}>
                  <Text variant="body" style={styles.changeView}>Change view</Text>
                </Pressable>
              </View>

              <View style={styles.sheetActions}>
                <Pressable style={styles.pillBtn} onPress={handleShare}>
                  <SymbolView name="square.and.arrow.up" size={16} tintColor={tc.mint} resizeMode="scaleAspectFit" />
                  <Text variant="body" style={styles.pillText}>Share</Text>
                </Pressable>
                <Pressable style={styles.pillBtn} onPress={() => setShowTimelapse(true)}>
                  <SymbolView name="play.fill" size={14} tintColor={tc.mint} resizeMode="scaleAspectFit" />
                  <Text variant="body" style={styles.pillText}>Timelapse</Text>
                </Pressable>
              </View>

              <Text variant="hero" style={styles.sectionTitle}>My countries</Text>
              {visitedList.length === 0 ? (
                <Text variant="body" style={styles.empty}>Tap a country on the map to open it — pinch to zoom, long-press to change the view. Mark it visited there or with ＋.</Text>
              ) : (
                visitedList.map(({ iso, name }) => (
                  <Pressable key={iso} onPress={() => openCountry(iso, name)} style={[styles.row, { minHeight: L.listRow }]}>
                    <View style={styles.rowDot} />
                    <Text variant="body" numberOfLines={1} style={styles.rowText}>{name}</Text>
                    <Text variant="body" style={styles.chevron}>›</Text>
                  </Pressable>
                ))
              )}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>

      {/* ── map-variant menu (long-press or "Change view") ── */}
      {showVariants && (
        <Pressable style={styles.variantsBackdrop} onPress={() => setShowVariants(false)}>
          <Pressable style={[styles.variantsCard, { marginBottom: L.insets.bottom + 100 }]} onPress={(e) => e.stopPropagation()}>
            <Text variant="hero" style={styles.variantsTitle}>Map view</Text>
            <VariantRow label="World" active={mapView.kind === "world"} onPress={() => pickVariant({ kind: "world" })} styles={styles} tc={tc} />
            <VariantRow label="Region heatmap" active={mapView.kind === "heatmap"} onPress={() => pickVariant({ kind: "heatmap" })} styles={styles} tc={tc} />
            {[...continentSets.keys()].map((name) => (
              <VariantRow
                key={name}
                label={name}
                active={mapView.kind === "continent" && mapView.name === name}
                onPress={() => pickVariant({ kind: "continent", name })}
                styles={styles}
                tc={tc}
              />
            ))}
          </Pressable>
        </Pressable>
      )}

      <ExploreMapModal visible={showMap} onClose={() => setShowMap(false)} />
      <AddVisitSheet visible={showAdd} onClose={() => setShowAdd(false)} onSaved={refreshVisited} />
      <HowToModal visible={showHelp} onClose={() => setShowHelp(false)} />
      <TimelapseModal
        visible={showTimelapse}
        onClose={() => setShowTimelapse(false)}
        visits={userVisits}
        continentByIso={continentByIso}
        continentSets={continentSets}
        theme={theme}
      />
    </View>
  );
}

function VariantRow({
  label, active, onPress, styles, tc,
}: {
  label: string; active: boolean; onPress: () => void; styles: ReturnType<typeof makeStyles>; tc: ThemeColors;
}) {
  return (
    <Pressable onPress={onPress} style={styles.variantRow}>
      <Text variant="body" style={[styles.variantLabel, active && { color: tc.mint, fontWeight: "700" }]}>{label}</Text>
      {active && <SymbolView name="checkmark" size={16} tintColor={tc.mint} resizeMode="scaleAspectFit" />}
    </Pressable>
  );
}

const makeStyles = (tc: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.bg },
  countryMapWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.md },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerSide: { width: 96, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerRight: { justifyContent: "flex-end" },
  iconBtn: { padding: 4 },
  scrubberWrap: { position: "absolute", zIndex: 5, backgroundColor: tc.surface, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, borderColor: tc.surfaceAlt },
  errorWrap: { position: "absolute", left: 0, right: 0, alignItems: "center", zIndex: 10 },
  error: { color: "#FF6B6B", backgroundColor: tc.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, overflow: "hidden" },
  statRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: spacing.xs },
  statCountWrap: { flexShrink: 1, minWidth: 0 },
  statCount: { color: tc.textPrimary, fontSize: 44, fontWeight: "800", letterSpacing: -1 },
  statTotal: { color: tc.textDim, fontSize: 24, fontWeight: "700" },
  statPct: { color: tc.mint, fontSize: 20, fontWeight: "700" },
  statLabel: { color: tc.textDim, fontSize: 14, marginTop: -2 },
  subRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statSub: { color: tc.textDim, fontSize: 13 },
  changeView: { color: tc.mint, fontSize: 13, fontWeight: "600" },
  hint: { color: tc.textDim, fontSize: 13 },
  sheetActions: { flexDirection: "row", gap: spacing.sm },
  pillBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: tc.mint },
  pillText: { color: tc.mint, fontWeight: "600", fontSize: 14 },
  sectionTitle: { fontSize: 20, fontWeight: "700", color: tc.textPrimary, marginTop: spacing.sm },
  empty: { color: tc.textDim },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tc.mint },
  rowText: { color: tc.textPrimary, fontSize: 16, flex: 1 },
  chevron: { color: tc.textDim, fontSize: 22 },
  countryBar: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs },
  worldBack: { width: 72 },
  worldBackText: { color: tc.mint, fontSize: 16, fontWeight: "600" },
  visitedToggle: { width: 72, alignItems: "flex-end" },
  visitedToggleText: { color: tc.textDim, fontSize: 15, fontWeight: "600" },
  visitedToggleOn: { color: tc.mint },
  countryName: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "700", color: tc.textPrimary },
  variantsBackdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", alignItems: "center", zIndex: 20 },
  variantsCard: { width: "88%", backgroundColor: tc.surfaceAlt, borderRadius: radius.card, padding: spacing.sm, gap: 2 },
  variantsTitle: { color: tc.textDim, fontSize: 13, fontWeight: "700", paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  variantRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
  variantLabel: { color: tc.textPrimary, fontSize: 16 },
});
