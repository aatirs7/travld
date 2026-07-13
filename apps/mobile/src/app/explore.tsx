import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
} from "@maplibre/maplibre-react-native";
import { colors, radius, spacing, Text, useLayout } from "@travld/ui";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
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

const PURPOSES = ["leisure", "lived", "work", "transit", "layover"] as const;
type Purpose = (typeof PURPOSES)[number];

export default function ExploreScreen() {
  const L = useLayout();
  const { theme } = useMapTheme();
  const cameraRef = useRef<CameraRef>(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);

  const loadPins = useCallback(async () => {
    try {
      const { pins } = await api.getPins();
      setPins(pins);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void loadPins();
  }, [loadPins]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { results } = await api.search(q.trim());
        if (!cancelled) setResults(results);
      } catch {
        if (!cancelled) setResults([]);
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
        properties: { name: p.name, level: p.level },
      })),
    }),
    [pins],
  );

  const pick = (r: SearchResult) => {
    setResults([]);
    setQ("");
    if (r.lat != null && r.lng != null) {
      cameraRef.current?.flyTo({
        center: [r.lng, r.lat] as [number, number],
        zoom: r.level === "city" ? 8 : r.level === "region" ? 5 : 3.5,
        duration: 1000,
      });
    }
    setSelected(r);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Map style={StyleSheet.absoluteFill} mapStyle={darkStyle as never}>
        <Camera
          ref={cameraRef}
          initialViewState={{ center: [10, 25] as [number, number], zoom: 1.3 }}
        />
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

      {/* search overlay */}
      <View style={[styles.searchWrap, { top: L.insets.top + spacing.sm, left: L.gutter, right: L.gutter }]}>
        <View style={styles.searchBar}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search a place to add…"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            maxFontSizeMultiplier={1.3}
          />
          {searching && <ActivityIndicator color={colors.mint} />}
        </View>
        {results.length > 0 && (
          <View style={styles.dropdown}>
            {results.slice(0, 8).map((r) => (
              <Pressable key={r.id} onPress={() => pick(r)} style={styles.resultRow}>
                <Text variant="body" numberOfLines={1} style={styles.resultText}>
                  {r.name}
                </Text>
                <Text variant="body" numberOfLines={1} style={styles.resultSub}>
                  {[r.displayType ?? cap(r.level), r.countryName].filter(Boolean).join(" · ")}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <AddVisitModal
        place={selected}
        onClose={() => setSelected(null)}
        onSaved={loadPins}
      />
    </View>
  );
}

function AddVisitModal({
  place,
  onClose,
  onSaved,
}: {
  place: SearchResult | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const L = useLayout();
  const [purpose, setPurpose] = useState<Purpose>("leisure");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPurpose("leisure");
    setNote("");
    setSaved(false);
  }, [place]);

  const save = useCallback(async () => {
    if (!place) return;
    setSaving(true);
    try {
      await api.createVisit({ placeId: place.id, purpose, note: note.trim() || null });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(true);
      onSaved();
      setTimeout(onClose, 700);
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [place, purpose, note, onClose, onSaved]);

  return (
    <Modal visible={place != null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={[styles.sheet, { paddingBottom: L.insets.bottom + spacing.lg, paddingHorizontal: L.gutter }]}>
          <View style={styles.sheetHandle} />
          <Text variant="hero" style={styles.sheetTitle} numberOfLines={1}>
            {place?.name}
          </Text>
          <Text variant="body" style={styles.dim}>
            {place?.countryName ?? ""}
          </Text>

          <Text variant="hero" style={styles.label}>
            PURPOSE
          </Text>
          <View style={styles.purposeRow}>
            {PURPOSES.map((p) => (
              <Pressable
                key={p}
                onPress={() => setPurpose(p)}
                style={[styles.purposeChip, purpose === p && styles.purposeChipActive]}
              >
                <Text variant="body" style={[styles.purposeText, purpose === p && styles.purposeTextActive]}>
                  {cap(p)}
                </Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note (optional)"
            placeholderTextColor={colors.textDim}
            style={styles.noteInput}
            multiline
            maxFontSizeMultiplier={1.5}
          />

          <View style={styles.sheetActions}>
            <Pressable onPress={onClose} style={styles.cancelBtn}>
              <Text variant="body" style={styles.cancelText}>
                Cancel
              </Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving} style={styles.saveBtn}>
              <Text variant="body" style={styles.saveText}>
                {saved ? "Saved ✓" : saving ? "Saving…" : "Add visit"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchWrap: { position: "absolute", gap: spacing.sm },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, color: colors.textPrimary, fontSize: 17, paddingVertical: spacing.md },
  dropdown: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    overflow: "hidden",
  },
  resultRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  resultText: { color: colors.textPrimary, fontSize: 16 },
  resultSub: { color: colors.textDim, fontSize: 13 },
  dim: { color: colors.textDim },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  sheetTitle: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  label: { fontSize: 13, color: colors.textDim, letterSpacing: 0.5, marginTop: spacing.sm },
  purposeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  purposeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  purposeChipActive: { backgroundColor: colors.mint },
  purposeText: { color: colors.textPrimary, fontSize: 14 },
  purposeTextActive: { color: colors.bg, fontWeight: "700" },
  noteInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.card,
    color: colors.textPrimary,
    padding: spacing.md,
    minHeight: 60,
    marginTop: spacing.sm,
  },
  sheetActions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  cancelBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  cancelText: { color: colors.textPrimary, fontWeight: "600" },
  saveBtn: { flex: 2, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.mint },
  saveText: { color: colors.bg, fontWeight: "700" },
});
