import { percentOfWorld, UN_COUNTRY_DENOMINATOR } from "@travld/core";
import { colors, radius, spacing, typography } from "@travld/ui";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { captureRef } from "react-native-view-shot";
import { PassportMap } from "@/components/PassportMap";
import { api, type CountryRow } from "@/lib/api";

export default function MapScreen() {
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const [unCount, setUnCount] = useState(0);
  const [countries, setCountries] = useState<CountryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cardRef = useRef<View>(null);

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

  const handleToggle = useCallback(
    async (iso2: string) => {
      const placeId = placeIdByIso2.get(iso2);
      if (placeId == null) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // non-negotiable
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
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      }
    } catch {
      /* user cancelled or capture failed */
    }
  }, []);

  const pct = percentOfWorld(unCount);
  const visitedNames = useMemo(
    () =>
      [...visited]
        .map((iso) => nameByIso2.get(iso) ?? iso)
        .sort((a, b) => a.localeCompare(b)),
    [visited, nameByIso2],
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.mint} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.wordmark}>travld</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          {/* Shareable card: map + hero number */}
          <View ref={cardRef} collapsable={false} style={styles.card}>
            <PassportMap visited={visited} onToggle={handleToggle} />
            <View style={styles.hero}>
              <View style={styles.heroNumberRow}>
                <Text style={styles.number}>{unCount}</Text>
                <Text style={styles.pct}>{pct}%</Text>
              </View>
              <Text style={styles.label}>
                COUNTRIES · {unCount} / {UN_COUNTRY_DENOMINATOR}
              </Text>
            </View>
          </View>

          <Pressable style={styles.shareBtn} onPress={handleShare}>
            <Text style={styles.shareText}>Share</Text>
          </Pressable>

          <Text style={styles.sectionTitle}>My Countries</Text>
          {visitedNames.length === 0 ? (
            <Text style={styles.empty}>Tap a country on the map to mark it visited.</Text>
          ) : (
            <View style={styles.list}>
              {visitedNames.map((name) => (
                <View key={name} style={styles.row}>
                  <View style={styles.dot} />
                  <Text style={styles.rowText}>{name}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: "center", justifyContent: "center" },
  safe: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  wordmark: {
    color: colors.mint,
    fontSize: 22,
    fontWeight: "200",
    letterSpacing: 6,
    textAlign: "center",
    marginVertical: spacing.sm,
  },
  error: { color: "#FF6B6B", textAlign: "center" },
  card: { backgroundColor: colors.bg, gap: spacing.md },
  hero: { alignItems: "center", gap: spacing.xs },
  heroNumberRow: { flexDirection: "row", alignItems: "flex-start" },
  number: {
    fontSize: typography.hero.fontSize,
    fontWeight: typography.hero.fontWeight,
    color: colors.mint,
    letterSpacing: typography.hero.letterSpacing,
  },
  pct: { fontSize: 20, color: colors.mint, marginTop: spacing.sm, marginLeft: spacing.xs },
  label: { ...typography.label, textTransform: "uppercase" },
  shareBtn: {
    alignSelf: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.mint,
  },
  shareText: { color: colors.mint, fontWeight: "600" },
  sectionTitle: { ...typography.title, marginTop: spacing.sm },
  empty: { color: colors.textDim },
  list: { gap: spacing.xs },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.mint },
  rowText: { color: colors.textPrimary, fontSize: 16 },
});
