import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import { type ThemeColors, radius, spacing, Text, useLayout } from "@travld/ui";
import { useAppColors } from "@/lib/app-theme";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import darkStyle from "@/assets/map-style-dark.json";
import { api, type TripDetail } from "@/lib/api";
import { useMapTheme } from "@/lib/map-theme-context";

const PURPOSE_ICON: Record<string, string> = {
  leisure: "🏖", lived: "🏠", work: "💼", transit: "✈️", layover: "🛬",
};

export function TripDetailModal({
  tripId,
  onClose,
  onChanged,
}: {
  tripId: number | null;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const L = useLayout();
  const { theme } = useMapTheme();
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);
  const cameraRef = useRef<CameraRef>(null);
  const [data, setData] = useState<TripDetail | null>(null);

  const load = useCallback(async (id: number) => {
    setData(null);
    try {
      setData(await api.getTrip(id));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (tripId != null) void load(tripId);
  }, [tripId, load]);

  const confirmDelete = useCallback(() => {
    if (tripId == null) return;
    Alert.alert("Delete trip?", "Your visits are kept — only the trip grouping is removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          await api.deleteTrip(tripId);
          onChanged?.();
          onClose();
        },
      },
    ]);
  }, [tripId, onChanged, onClose]);

  const route = data?.route ?? [];
  const routeGeoJSON = {
    type: "FeatureCollection" as const,
    features: [
      ...(route.length >= 2
        ? [{
            type: "Feature" as const,
            geometry: { type: "LineString" as const, coordinates: route.map((r) => [r.lng, r.lat]) },
            properties: {},
          }]
        : []),
      ...route.map((r) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] },
        properties: {},
      })),
    ],
  };

  return (
    <Modal visible={tripId != null} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: L.insets.top + spacing.sm, paddingHorizontal: L.gutter }]}>
          <Pressable onPress={onClose} hitSlop={16} style={styles.backBtn}>
            <Text variant="hero" style={styles.close}>‹ Back</Text>
          </Pressable>
          <Text variant="hero" style={styles.title} numberOfLines={1}>{data?.trip.title ?? "…"}</Text>
          <View style={styles.backBtn} />
        </View>

        {!data ? (
          <View style={styles.center}><ActivityIndicator color={tc.mint} /></View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: L.scrollPadBottom }} showsVerticalScrollIndicator={false}>
            <View style={styles.mapWrap}>
              <Map style={StyleSheet.absoluteFill} mapStyle={darkStyle as never}>
                <Camera ref={cameraRef} initialViewState={{ center: [route[0]?.lng ?? 10, route[0]?.lat ?? 25] as [number, number], zoom: route.length ? 3 : 1.2 }} />
                <GeoJSONSource id="route" data={routeGeoJSON}>
                  <Layer id="route-line" source="route" type="line" style={{ lineColor: theme.visited, lineWidth: 2.5, lineOpacity: 0.9 }} />
                  <Layer id="route-pins" source="route" type="circle" style={{ circleRadius: 5, circleColor: theme.visited, circleStrokeColor: "#000", circleStrokeWidth: 1.5 }} />
                </GeoJSONSource>
              </Map>
            </View>

            <View style={{ paddingHorizontal: L.gutter, gap: L.sectionGap, paddingTop: spacing.md }}>
              {/* stats strip */}
              <View style={styles.stats}>
                <Stat value={data.trip.days ?? "—"} label="Days" />
                <Stat value={data.trip.countryCount} label="Countries" />
                <Stat value={data.trip.stopCount} label="Stops" />
                <Stat value={data.distanceKm >= 1000 ? `${Math.round(data.distanceKm / 1000)}k` : data.distanceKm} label="km" />
              </View>

              {data.companions.length > 0 && (
                <Text variant="body" style={styles.companions}>With {data.companions.map((c) => `@${c}`).join(", ")}</Text>
              )}

              <Text variant="hero" style={styles.section}>Stops</Text>
              {data.visits.map((v) => (
                <View key={v.id} style={[styles.stopRow, { minHeight: L.listRow }]}>
                  <Text variant="body" style={styles.stopIcon}>{PURPOSE_ICON[v.purpose] ?? "📍"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" numberOfLines={1} style={styles.stopName}>{v.placeName}</Text>
                    {v.note ? <Text variant="body" numberOfLines={1} style={styles.stopNote}>{v.note}</Text> : null}
                  </View>
                  <Text variant="body" style={styles.stopDate}>{v.arrivedAt ? v.arrivedAt.slice(0, 10) : "—"}</Text>
                </View>
              ))}

              <Pressable onPress={confirmDelete} style={styles.deleteBtn}>
                <Text variant="body" style={styles.deleteText}>Delete trip</Text>
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);
  return (
    <View style={styles.stat}>
      <Text variant="hero" style={styles.statValue}>{value}</Text>
      <Text variant="hero" style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

const makeStyles = (tc: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.bg },
  header: { flexDirection: "row", alignItems: "center", paddingBottom: spacing.sm },
  backBtn: { width: 76, justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: tc.textPrimary, flex: 1, textAlign: "center" },
  close: { color: tc.mint, fontSize: 17, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  mapWrap: { width: "100%", aspectRatio: 1.4, backgroundColor: tc.surface },
  stats: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, backgroundColor: tc.surface, borderRadius: radius.card, paddingVertical: spacing.md, alignItems: "center", gap: 2 },
  statValue: { color: tc.mint, fontSize: 22, fontWeight: "700" },
  statLabel: { color: tc.textDim, fontSize: 10, letterSpacing: 0.5 },
  companions: { color: tc.textPrimary },
  section: { fontSize: 20, fontWeight: "700", color: tc.textPrimary },
  stopRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  stopIcon: { fontSize: 20 },
  stopName: { color: tc.textPrimary, fontSize: 16 },
  stopNote: { color: tc.textDim, fontSize: 13 },
  stopDate: { color: tc.textDim, fontSize: 13 },
  deleteBtn: { alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: "#FF6B6B", marginTop: spacing.sm },
  deleteText: { color: "#FF6B6B", fontWeight: "600" },
});
