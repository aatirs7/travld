import { colors, radius, spacing, Text, useLayout } from "@travld/ui";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { CountryMap } from "@/components/CountryMap";
import { ProgressRing } from "@/components/ProgressRing";
import {
  api,
  type Admin1Map,
  type CityRow,
  type CountryDetail,
  type VisitDetailRow,
} from "@/lib/api";
import { useMapTheme } from "@/lib/map-theme-context";

type Tab = "states" | "cities" | "visits" | "photos";
const TABS: Tab[] = ["states", "cities", "visits", "photos"];

interface Props {
  iso2: string | null;
  onClose: () => void;
  onChanged?: () => void;
}

export function CountryDetailSheet({ iso2, onClose, onChanged }: Props) {
  const { theme } = useMapTheme();
  const L = useLayout();
  const [detail, setDetail] = useState<CountryDetail | null>(null);
  const [admin1, setAdmin1] = useState<Admin1Map | null>(null);
  const [cities, setCities] = useState<CityRow[] | null>(null);
  const [visits, setVisits] = useState<VisitDetailRow[] | null>(null);
  const [tab, setTab] = useState<Tab>("states");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const [d, m] = await Promise.all([
        api.getCountry(code),
        api.getAdmin1Map(code).catch(() => null),
      ]);
      setDetail(d);
      setAdmin1(m);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!iso2) return;
    setDetail(null);
    setAdmin1(null);
    setCities(null);
    setVisits(null);
    setTab("states");
    void load(iso2);
  }, [iso2, load]);

  useEffect(() => {
    if (!iso2) return;
    if (tab === "cities" && cities == null) api.getCountryCities(iso2).then((r) => setCities(r.cities));
    if (tab === "visits" && visits == null) api.getCountryVisits(iso2).then((r) => setVisits(r.visits));
  }, [tab, iso2, cities, visits]);

  const visitedNames = useMemo(
    () =>
      new Set((detail?.regions ?? []).filter((r) => r.visited).map((r) => r.name.toLowerCase())),
    [detail],
  );
  const idByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of detail?.regions ?? []) m.set(r.name.toLowerCase(), r.id);
    return m;
  }, [detail]);

  const toggleRegion = useCallback(
    async (placeId: number) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await api.togglePlace(placeId);
      if (iso2) await load(iso2);
      onChanged?.();
    },
    [iso2, load, onChanged],
  );

  const toggleCity = useCallback(
    async (cityId: number) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await api.togglePlace(cityId);
      if (iso2) {
        const [c] = await Promise.all([api.getCountryCities(iso2), load(iso2)]);
        setCities(c.cities);
      }
      onChanged?.();
    },
    [iso2, load, onChanged],
  );

  const regionLabel = detail?.regions[0]?.displayType ?? "Regions";

  return (
    <Modal visible={iso2 != null} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: L.insets.top + spacing.sm, paddingHorizontal: L.gutter }]}>
          <Text variant="hero" style={styles.title} numberOfLines={1}>
            {detail?.name ?? "…"}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text variant="hero" style={styles.close}>
              Done
            </Text>
          </Pressable>
        </View>

        {loading || !detail ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.mint} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: L.gutter,
              paddingBottom: L.scrollPadBottom,
              gap: L.sectionGap,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topRow}>
              {admin1 ? (
                <View style={styles.mapWrap}>
                  <CountryMap
                    map={admin1}
                    visitedNames={visitedNames}
                    theme={theme}
                    onRegionPress={(name) => {
                      const id = idByName.get(name.toLowerCase());
                      if (id != null) void toggleRegion(id);
                    }}
                  />
                </View>
              ) : (
                <View style={[styles.mapWrap, styles.center]}>
                  <Text variant="body" style={styles.dim}>
                    No map
                  </Text>
                </View>
              )}
              <ProgressRing
                value={detail.regionVisited}
                total={detail.regionTotal}
                label={regionLabel}
                color={theme.visited}
              />
            </View>

            {/* segmented control */}
            <View style={styles.segment}>
              {TABS.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={[styles.segItem, tab === t && styles.segItemActive]}
                >
                  <Text
                    variant="body"
                    style={[styles.segText, tab === t && styles.segTextActive]}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === "states" && (
              <View>
                {detail.regions.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => toggleRegion(r.id)}
                    style={[styles.row, { minHeight: L.listRow }]}
                  >
                    <View style={[styles.dot, { backgroundColor: r.visited ? theme.visited : colors.grey }]} />
                    <Text variant="body" numberOfLines={1} ellipsizeMode="tail" style={styles.rowText}>
                      {r.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {tab === "cities" && (
              <ListOrLoading
                data={cities}
                empty="No cities."
                render={(c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => toggleCity(c.id)}
                    style={[styles.row, { minHeight: L.listRow }]}
                  >
                    <View style={[styles.dot, { backgroundColor: c.visited ? theme.visited : colors.grey }]} />
                    <Text variant="body" numberOfLines={1} ellipsizeMode="tail" style={styles.rowText}>
                      {c.name}
                    </Text>
                  </Pressable>
                )}
              />
            )}

            {tab === "visits" && (
              <ListOrLoading
                data={visits}
                empty="No visits logged here yet."
                render={(v) => (
                  <View key={v.id} style={[styles.row, { minHeight: L.listRow }]}>
                    <View style={[styles.dot, { backgroundColor: theme.visited }]} />
                    <Text variant="body" numberOfLines={1} style={styles.rowText}>
                      {v.placeName}
                    </Text>
                    <Text variant="body" style={styles.rowMeta}>
                      {v.purpose}
                    </Text>
                  </View>
                )}
              />
            )}

            {tab === "photos" && (
              <Text variant="body" style={styles.dim}>
                Photos arrive in a later update.
              </Text>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function ListOrLoading<T>({
  data,
  empty,
  render,
}: {
  data: T[] | null;
  empty: string;
  render: (item: T) => React.ReactNode;
}) {
  if (data == null) return <ActivityIndicator color={colors.mint} />;
  if (data.length === 0) return <Text variant="body" style={styles.dim}>{empty}</Text>;
  return <View>{data.map(render)}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  title: { fontSize: 24, fontWeight: "700", color: colors.textPrimary, flex: 1, marginRight: spacing.md },
  close: { color: colors.mint, fontSize: 17, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  topRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: spacing.sm },
  mapWrap: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.card, overflow: "hidden", padding: spacing.sm },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 3,
  },
  segItem: { flex: 1, paddingVertical: spacing.sm, alignItems: "center", borderRadius: radius.pill },
  segItemActive: { backgroundColor: colors.surfaceAlt },
  segText: { color: colors.textDim, fontSize: 13 },
  segTextActive: { color: colors.textPrimary, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowText: { color: colors.textPrimary, fontSize: 16, flex: 1 },
  rowMeta: { color: colors.textDim, fontSize: 13, textTransform: "uppercase" },
  dim: { color: colors.textDim },
});
