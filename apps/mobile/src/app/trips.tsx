import type { EnrichedVisit } from "@travld/core";
import { colors, radius, spacing, Text, useLayout } from "@travld/ui";
import { useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { TripDetailModal } from "@/components/TripDetailModal";
import { api, type TripListItem } from "@/lib/api";
import { useMapTheme } from "@/lib/map-theme-context";

export default function TripsScreen() {
  const L = useLayout();
  const { theme } = useMapTheme();
  const [trips, setTrips] = useState<TripListItem[] | null>(null);
  const [ungrouped, setUngrouped] = useState<EnrichedVisit[]>([]);
  const [openTrip, setOpenTrip] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, u] = await Promise.all([api.getTrips(), api.getUngrouped()]);
      setTrips(t.trips);
      setUngrouped(u.visits);
    } catch {
      setTrips([]);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const createTrip = useCallback(() => {
    Alert.prompt?.("New trip", "Name your trip", async (title?: string) => {
      if (title?.trim()) {
        const { id } = await api.createTrip(title.trim());
        await load();
        setOpenTrip(id);
      }
    });
  }, [load]);

  const addToTrip = useCallback(
    (visit: EnrichedVisit) => {
      if (!trips || trips.length === 0) {
        createTrip();
        return;
      }
      Alert.alert("Add to trip", visit.placeName, [
        ...trips.slice(0, 4).map((t) => ({
          text: t.title,
          onPress: async () => {
            await api.setVisitTrip(visit.id, t.id);
            await load();
          },
        })),
        { text: "Cancel", style: "cancel" as const },
      ]);
    },
    [trips, createTrip, load],
  );

  const byYear = groupByYear(ungrouped);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={{ paddingTop: L.insets.top + spacing.sm, paddingHorizontal: L.gutter }}>
        <View style={styles.headerRow}>
          <Text variant="hero" style={styles.h1}>Trips</Text>
          <Pressable onPress={createTrip} style={styles.newBtn}>
            <Text variant="body" style={styles.newText}>+ New</Text>
          </Pressable>
        </View>
      </View>

      {trips == null ? (
        <View style={styles.center}><ActivityIndicator color={colors.mint} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: L.gutter, paddingTop: spacing.md, paddingBottom: L.scrollPadBottom, gap: spacing.md }}
          showsVerticalScrollIndicator={false}
        >
          {trips.length === 0 && ungrouped.length === 0 && (
            <View style={styles.empty}>
              <Text variant="hero" style={styles.emptyTitle}>Your trips will show up here.</Text>
              <Pressable onPress={createTrip} style={styles.cta}>
                <Text variant="body" style={styles.ctaText}>Create a trip</Text>
              </Pressable>
            </View>
          )}

          {trips.map((t) => (
            <Pressable key={t.id} onPress={() => setOpenTrip(t.id)} style={styles.tripCard}>
              <View style={styles.tripTop}>
                <Text variant="body" numberOfLines={1} style={styles.tripTitle}>{t.title}</Text>
                {t.hasFirstVisit && <View style={[styles.dot, { backgroundColor: theme.visited }]} />}
              </View>
              <Text variant="body" style={styles.tripMeta}>
                {formatRange(t.startDate, t.endDate)}
              </Text>
              <Text variant="body" style={styles.tripCounts}>
                {t.countryCount} countries · {t.stopCount} stops
                {t.companions.length > 0 ? `  ·  ${t.companions.map((c) => `@${c}`).join(" ")}` : ""}
              </Text>
            </Pressable>
          ))}

          {byYear.length > 0 && (
            <>
              <Text variant="hero" style={styles.section}>Ungrouped visits</Text>
              {byYear.map(([year, visits]) => (
                <View key={year} style={{ gap: spacing.xs }}>
                  <Text variant="hero" style={styles.year}>{year}</Text>
                  {visits.map((v) => (
                    <Pressable key={v.id} onPress={() => addToTrip(v)} style={[styles.ungRow, { minHeight: L.listRow }]}>
                      <Text variant="body" numberOfLines={1} style={styles.ungName}>{v.placeName}</Text>
                      <Text variant="body" style={styles.ungAdd}>Add to trip</Text>
                    </Pressable>
                  ))}
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <TripDetailModal tripId={openTrip} onClose={() => setOpenTrip(null)} onChanged={load} />
    </View>
  );
}

function groupByYear(visits: EnrichedVisit[]): [string, EnrichedVisit[]][] {
  const map = new Map<string, EnrichedVisit[]>();
  for (const v of visits) {
    const year = v.arrivedAt ? v.arrivedAt.slice(0, 4) : "Undated";
    if (!map.has(year)) map.set(year, []);
    map.get(year)!.push(v);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
}

function formatRange(start: string | null, end: string | null): string {
  if (!start) return "No dates yet";
  const s = start.slice(0, 10);
  const e = end ? end.slice(0, 10) : s;
  return s === e ? s : `${s} → ${e}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  h1: { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  newBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.mint },
  newText: { color: colors.mint, fontWeight: "600" },
  empty: { alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, textAlign: "center" },
  cta: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.mint },
  ctaText: { color: colors.bg, fontWeight: "700" },
  tripCard: { backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.md, gap: spacing.xs },
  tripTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  tripTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: "700", flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tripMeta: { color: colors.textDim, fontSize: 13 },
  tripCounts: { color: colors.textPrimary, fontSize: 14 },
  section: { fontSize: 20, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.sm },
  year: { color: colors.textDim, fontSize: 14, fontWeight: "700", marginTop: spacing.xs },
  ungRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  ungName: { color: colors.textPrimary, fontSize: 16, flex: 1 },
  ungAdd: { color: colors.mint, fontSize: 13, fontWeight: "600" },
});
