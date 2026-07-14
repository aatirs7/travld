import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import { type ThemeColors, radius, spacing, Text, useLayout } from "@travld/ui";
import { useAppColors } from "@/lib/app-theme";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import darkStyle from "@/assets/map-style-dark.json";
import { api, type Pin, type SearchResult } from "@/lib/api";
import { useMapTheme } from "@/lib/map-theme-context";

/** Freeform MapLibre browse map: visited pins + search-to-fly. A tool, not a tab. */
export function ExploreMapModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const L = useLayout();
  const { theme } = useMapTheme();
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);
  const cameraRef = useRef<CameraRef>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pins, setPins] = useState<Pin[]>([]);

  useEffect(() => {
    if (visible) api.getPins().then((r) => setPins(r.pins)).catch(() => {});
    else {
      setQ("");
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    if (q.trim().length < 2) return setResults([]);
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { results } = await api.search(q.trim());
        if (!cancelled) setResults(results);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q]);

  const pinsGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: pins.map((p) => ({
        type: "Feature" as const,
        id: p.id,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: {},
      })),
    }),
    [pins],
  );

  const pick = useCallback((r: SearchResult) => {
    setResults([]);
    setQ("");
    if (r.lat != null && r.lng != null) {
      cameraRef.current?.flyTo({
        center: [r.lng, r.lat] as [number, number],
        zoom: r.level === "city" ? 8 : r.level === "region" ? 5 : 3.5,
        duration: 1000,
      });
    }
  }, []);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Map style={StyleSheet.absoluteFill} mapStyle={darkStyle as never}>
          <Camera ref={cameraRef} initialViewState={{ center: [10, 25] as [number, number], zoom: 1.3 }} />
          <GeoJSONSource id="pins" data={pinsGeoJSON}>
            <Layer
              id="pin-circles"
              source="pins"
              type="circle"
              style={{
                circleRadius: 6,
                circleColor: theme.visited,
                circleStrokeColor: "#000000",
                circleStrokeWidth: 1.5,
                circleOpacity: 0.9,
              }}
            />
          </GeoJSONSource>
        </Map>

        <View style={[styles.overlay, { top: L.insets.top + spacing.sm, left: L.gutter, right: L.gutter }]}>
          <View style={styles.searchBar}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search to fly there…"
              placeholderTextColor={tc.textDim}
              style={styles.input}
              autoCorrect={false}
              maxFontSizeMultiplier={1.3}
            />
            {searching ? (
              <ActivityIndicator color={tc.mint} />
            ) : (
              <Pressable onPress={onClose} hitSlop={12}>
                <Text variant="body" style={styles.close}>Done</Text>
              </Pressable>
            )}
          </View>
          {results.length > 0 && (
            <View style={styles.dropdown}>
              {results.slice(0, 8).map((r) => (
                <Pressable key={r.id} onPress={() => pick(r)} style={styles.resultRow}>
                  <Text variant="body" numberOfLines={1} style={styles.resultText}>{r.name}</Text>
                  <Text variant="body" numberOfLines={1} style={styles.resultSub}>{r.countryName ?? r.level}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (tc: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: tc.bg },
  overlay: { position: "absolute", gap: spacing.sm },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: tc.surface, borderRadius: radius.card, paddingHorizontal: spacing.md },
  input: { flex: 1, color: tc.textPrimary, fontSize: 17, paddingVertical: spacing.md },
  close: { color: tc.mint, fontWeight: "600", fontSize: 16 },
  dropdown: { backgroundColor: tc.surface, borderRadius: radius.card, overflow: "hidden" },
  resultRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  resultText: { color: tc.textPrimary, fontSize: 16 },
  resultSub: { color: tc.textDim, fontSize: 13 },
});
