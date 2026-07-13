import { colors, radius, spacing, Text, useLayout } from "@travld/ui";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { api, type SearchResult } from "@/lib/api";

const PURPOSES = ["leisure", "lived", "work", "transit", "layover"] as const;
type Purpose = (typeof PURPOSES)[number];

export default function ExploreScreen() {
  const L = useLayout();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);

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

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={{ paddingTop: L.insets.top + spacing.sm, paddingHorizontal: L.gutter, gap: spacing.md }}>
        <Text variant="hero" style={styles.h1}>
          Explore
        </Text>
        <View style={styles.searchBar}>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search countries, states, cities…"
            placeholderTextColor={colors.textDim}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
            maxFontSizeMultiplier={1.3}
          />
          {searching && <ActivityIndicator color={colors.mint} />}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: L.gutter,
          paddingTop: spacing.md,
          paddingBottom: L.scrollPadBottom,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {q.trim().length >= 2 && results.length === 0 && !searching && (
          <Text variant="body" style={styles.dim}>
            No matches.
          </Text>
        )}
        {results.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => setSelected(r)}
            style={[styles.row, { minHeight: L.listRow }]}
          >
            <View style={styles.rowMain}>
              <Text variant="body" numberOfLines={1} ellipsizeMode="tail" style={styles.rowText}>
                {r.name}
              </Text>
              <Text variant="body" numberOfLines={1} style={styles.rowSub}>
                {[r.displayType ?? cap(r.level), r.countryName].filter(Boolean).join(" · ")}
              </Text>
            </View>
            <Text variant="body" style={styles.plus}>
              +
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <AddVisitModal place={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

function AddVisitModal({ place, onClose }: { place: SearchResult | null; onClose: () => void }) {
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
      setTimeout(onClose, 700);
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [place, purpose, note, onClose]);

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
  h1: { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, color: colors.textPrimary, fontSize: 17, paddingVertical: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowMain: { flex: 1 },
  rowText: { color: colors.textPrimary, fontSize: 16 },
  rowSub: { color: colors.textDim, fontSize: 13 },
  plus: { color: colors.mint, fontSize: 24, fontWeight: "300", paddingHorizontal: spacing.sm },
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
