import { colors, radius, spacing, Text, useLayout } from "@travld/ui";
import * as Haptics from "expo-haptics";
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
import { api, type CountryRow, type SearchResult, type TripListItem, type UserSearchRow } from "@/lib/api";

// browse a country without typing → treat it as a place to add
function countryToResult(c: CountryRow): SearchResult {
  return {
    id: c.id,
    name: c.name,
    level: "country",
    displayType: null,
    countryName: null,
    countryIso2: c.iso2,
    lat: null,
    lng: null,
  };
}

const PURPOSES = ["leisure", "lived", "work", "transit", "layover"] as const;
type Purpose = (typeof PURPOSES)[number];

export function AddVisitSheet({
  visible,
  onClose,
  onSaved,
}: {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const L = useLayout();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [place, setPlace] = useState<SearchResult | null>(null);
  const [purpose, setPurpose] = useState<Purpose>("leisure");
  const [note, setNote] = useState("");
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [tripId, setTripId] = useState<number | null>(null);
  const [newTripTitle, setNewTripTitle] = useState("");
  const [tagged, setTagged] = useState<UserSearchRow[]>([]);
  const [userQ, setUserQ] = useState("");
  const [userResults, setUserResults] = useState<UserSearchRow[]>([]);
  const [allCountries, setAllCountries] = useState<CountryRow[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      api.getTrips().then((r) => setTrips(r.trips)).catch(() => {});
      if (allCountries.length === 0)
        api.listCountries().then((r) => setAllCountries(r.countries)).catch(() => {});
    } else {
      setQ("");
      setResults([]);
      setPlace(null);
      setPurpose("leisure");
      setNote("");
      setTripId(null);
      setNewTripTitle("");
      setTagged([]);
      setUserQ("");
      setUserResults([]);
    }
  }, [visible]);

  useEffect(() => {
    if (userQ.trim().length < 1) return setUserResults([]);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { users } = await api.searchUsers(userQ.trim());
        if (!cancelled) setUserResults(users);
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [userQ]);

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

  const save = useCallback(async () => {
    if (!place) return;
    setSaving(true);
    try {
      let finalTrip = tripId;
      if (newTripTitle.trim()) finalTrip = (await api.createTrip(newTripTitle.trim())).id;
      const res = await api.createVisit({ placeId: place.id, purpose, note: note.trim() || null, tripId: finalTrip });
      if (res.visitId && tagged.length > 0) {
        await Promise.all(tagged.map((u) => api.tagVisit(res.visitId, u.id).catch(() => {})));
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved?.();
      onClose();
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }, [place, purpose, note, tripId, newTripTitle, tagged, onSaved, onClose]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: L.insets.top + spacing.sm, paddingHorizontal: L.gutter }]}>
          <Text variant="hero" style={styles.title}>Add a visit</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text variant="hero" style={styles.close}>Cancel</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: L.gutter, paddingBottom: L.scrollPadBottom, gap: spacing.md }}
          keyboardShouldPersistTaps="handled"
        >
          {!place ? (
            <>
              <View style={styles.searchBar}>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Search cities, states, countries…"
                  placeholderTextColor={colors.textDim}
                  style={styles.input}
                  autoCorrect={false}
                  maxFontSizeMultiplier={1.3}
                />
                {searching && <ActivityIndicator color={colors.mint} />}
              </View>

              {q.trim().length < 2 ? (
                // browse: pick a country from the list (no typing needed)
                <>
                  <Text variant="hero" style={styles.browseLabel}>ALL COUNTRIES</Text>
                  {allCountries.map((c) => (
                    <Pressable
                      key={c.id}
                      onPress={() => setPlace(countryToResult(c))}
                      style={[styles.row, { minHeight: L.listRow }]}
                    >
                      <Text variant="body" numberOfLines={1} style={styles.rowText}>{c.name}</Text>
                      <Text variant="body" style={styles.plus}>+</Text>
                    </Pressable>
                  ))}
                </>
              ) : (
                results.map((r) => (
                  <Pressable key={r.id} onPress={() => setPlace(r)} style={[styles.row, { minHeight: L.listRow }]}>
                    <View style={{ flex: 1 }}>
                      <Text variant="body" numberOfLines={1} style={styles.rowText}>{r.name}</Text>
                      <Text variant="body" numberOfLines={1} style={styles.rowSub}>
                        {[r.displayType ?? r.level, r.countryName].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <Text variant="body" style={styles.plus}>+</Text>
                  </Pressable>
                ))
              )}
            </>
          ) : (
            <>
              <Text variant="hero" style={styles.selected} numberOfLines={1}>{place.name}</Text>
              <Text variant="body" style={styles.dim}>{place.countryName ?? ""}</Text>

              <Text variant="hero" style={styles.label}>PURPOSE</Text>
              <View style={styles.chips}>
                {PURPOSES.map((p) => (
                  <Pressable key={p} onPress={() => setPurpose(p)} style={[styles.chip, purpose === p && styles.chipActive]}>
                    <Text variant="body" style={[styles.chipText, purpose === p && styles.chipTextActive]}>{cap(p)}</Text>
                  </Pressable>
                ))}
              </View>

              <Text variant="hero" style={styles.label}>ADD TO TRIP</Text>
              <View style={styles.chips}>
                <Pressable onPress={() => { setTripId(null); setNewTripTitle(""); }} style={[styles.chip, tripId === null && !newTripTitle && styles.chipActive]}>
                  <Text variant="body" style={[styles.chipText, tripId === null && !newTripTitle && styles.chipTextActive]}>None</Text>
                </Pressable>
                {trips.slice(0, 6).map((t) => (
                  <Pressable key={t.id} onPress={() => { setTripId(t.id); setNewTripTitle(""); }} style={[styles.chip, tripId === t.id && styles.chipActive]}>
                    <Text variant="body" numberOfLines={1} style={[styles.chipText, tripId === t.id && styles.chipTextActive]}>{t.title}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={newTripTitle}
                onChangeText={(v) => { setNewTripTitle(v); if (v) setTripId(null); }}
                placeholder="+ New trip title"
                placeholderTextColor={colors.textDim}
                style={styles.newTrip}
                maxFontSizeMultiplier={1.3}
              />

              <Text variant="hero" style={styles.label}>TAG PEOPLE</Text>
              {tagged.length > 0 && (
                <View style={styles.chips}>
                  {tagged.map((u) => (
                    <Pressable key={u.id} onPress={() => setTagged((t) => t.filter((x) => x.id !== u.id))} style={[styles.chip, styles.chipActive]}>
                      <Text variant="body" style={styles.chipTextActive}>@{u.handle} ✕</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <TextInput
                value={userQ}
                onChangeText={setUserQ}
                placeholder="Search people by @handle"
                placeholderTextColor={colors.textDim}
                style={styles.newTrip}
                autoCapitalize="none"
                maxFontSizeMultiplier={1.3}
              />
              {userResults.filter((u) => !tagged.some((t) => t.id === u.id)).map((u) => (
                <Pressable
                  key={u.id}
                  onPress={() => { setTagged((t) => [...t, u]); setUserQ(""); setUserResults([]); }}
                  style={styles.row}
                >
                  <Text variant="body" style={styles.rowText}>{u.displayName}</Text>
                  <Text variant="body" style={styles.rowSub}>@{u.handle}</Text>
                </Pressable>
              ))}

              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Add a note (optional)"
                placeholderTextColor={colors.textDim}
                style={styles.noteInput}
                multiline
                maxFontSizeMultiplier={1.5}
              />

              <View style={styles.actions}>
                <Pressable onPress={() => setPlace(null)} style={styles.backBtn}>
                  <Text variant="body" style={styles.backText}>Back</Text>
                </Pressable>
                <Pressable onPress={save} disabled={saving} style={styles.saveBtn}>
                  <Text variant="body" style={styles.saveText}>{saving ? "Saving…" : "Add visit"}</Text>
                </Pressable>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: spacing.md },
  title: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  close: { color: colors.mint, fontSize: 17, fontWeight: "600" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.card, paddingHorizontal: spacing.md },
  input: { flex: 1, color: colors.textPrimary, fontSize: 17, paddingVertical: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rowText: { color: colors.textPrimary, fontSize: 16 },
  rowSub: { color: colors.textDim, fontSize: 13 },
  browseLabel: { color: colors.textDim, fontSize: 12, letterSpacing: 1, marginTop: spacing.sm },
  plus: { color: colors.mint, fontSize: 24, fontWeight: "300", paddingHorizontal: spacing.sm },
  selected: { fontSize: 24, fontWeight: "700", color: colors.textPrimary },
  dim: { color: colors.textDim },
  label: { fontSize: 13, color: colors.textDim, letterSpacing: 0.5, marginTop: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt, maxWidth: 200 },
  chipActive: { backgroundColor: colors.mint },
  chipText: { color: colors.textPrimary, fontSize: 14 },
  chipTextActive: { color: colors.bg, fontWeight: "700" },
  newTrip: { backgroundColor: colors.surfaceAlt, borderRadius: radius.card, color: colors.textPrimary, padding: spacing.md },
  noteInput: { backgroundColor: colors.surfaceAlt, borderRadius: radius.card, color: colors.textPrimary, padding: spacing.md, minHeight: 60 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  backBtn: { flex: 1, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  backText: { color: colors.textPrimary, fontWeight: "600" },
  saveBtn: { flex: 2, alignItems: "center", paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.mint },
  saveText: { color: colors.bg, fontWeight: "700" },
});
