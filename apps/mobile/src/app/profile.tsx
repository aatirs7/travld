import { mapThemePresets, type MapTheme } from "@travld/core";
import { colors, radius, spacing, Text, useLayout } from "@travld/ui";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { PassportMap } from "@/components/PassportMap";
import { ScreenHeader } from "@/components/ScreenHeader";
import { api } from "@/lib/api";
import { useMapTheme } from "@/lib/map-theme-context";

const VISITED_SWATCHES = [
  "#00E08F", "#38EF7D", "#4EA8FF", "#5B8DEF", "#B18CFF", "#FF5D8F",
  "#FF9F0A", "#FFD60A", "#FF6B3D", "#FF4D4D", "#2EE6C9", "#FFFFFF",
];

const PREVIEW = new Set(["US", "BR", "PK", "JP", "AU", "ZA", "FR", "EG"]);

export default function ProfileScreen() {
  const { theme, setTheme } = useMapTheme();
  const L = useLayout();
  const [includeTransit, setIncludeTransit] = useState(false);

  useEffect(() => {
    api.getSettings().then((r) => setIncludeTransit(r.settings.includeTransit)).catch(() => {});
  }, []);

  const apply = (next: MapTheme) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void setTheme(next);
  };

  const toggleTransit = (value: boolean) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIncludeTransit(value); // optimistic
    api.setSettings({ includeTransit: value }).catch(() => setIncludeTransit(!value));
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader title="Profile" />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: L.gutter,
          paddingTop: spacing.sm,
          paddingBottom: L.scrollPadBottom,
          gap: L.sectionGap,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="hero" style={styles.section}>
          Map Style
        </Text>
        <View style={[styles.preview, { padding: L.cardPad }]}>
          <PassportMap visited={PREVIEW} theme={theme} />
        </View>

        <Text variant="hero" style={styles.label}>
          PRESETS
        </Text>
        <View style={styles.presetRow}>
          {mapThemePresets.map((p) => {
            const active = p.theme.visited === theme.visited && p.theme.land === theme.land;
            return (
              <Pressable
                key={p.id}
                onPress={() => apply(p.theme)}
                style={[styles.preset, active && styles.presetActive]}
              >
                <View style={[styles.presetSwatch, { backgroundColor: p.theme.visited }]} />
                <Text variant="body" style={styles.presetName}>
                  {p.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="hero" style={styles.label}>
          VISITED COLOR
        </Text>
        <View style={styles.swatchGrid}>
          {VISITED_SWATCHES.map((hex) => {
            const active = hex.toLowerCase() === theme.visited.toLowerCase();
            return (
              <Pressable
                key={hex}
                onPress={() => apply({ ...theme, visited: hex })}
                style={[styles.swatch, { backgroundColor: hex }, active && styles.swatchActive]}
              />
            );
          })}
        </View>

        <Text variant="body" style={styles.hint}>
          Changes save automatically and sync to your maps.
        </Text>

        <Text variant="hero" style={styles.section}>
          Counting
        </Text>
        <View style={styles.settingRow}>
          <View style={styles.settingMain}>
            <Text variant="body" style={styles.settingTitle}>
              Count layovers & transits
            </Text>
            <Text variant="body" style={styles.hint}>
              Off by default — a country you only passed through in transit doesn’t count.
            </Text>
          </View>
          <Switch
            value={includeTransit}
            onValueChange={toggleTransit}
            trackColor={{ true: theme.visited, false: colors.grey }}
            thumbColor={colors.textPrimary}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  section: { fontSize: 22, fontWeight: "700", color: colors.textPrimary },
  preview: { borderRadius: radius.card, overflow: "hidden", backgroundColor: colors.surface },
  label: { fontSize: 13, color: colors.textDim, letterSpacing: 0.5, textTransform: "uppercase" },
  presetRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  preset: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "transparent",
  },
  presetActive: { borderColor: colors.textPrimary },
  presetSwatch: { width: 16, height: 16, borderRadius: 8 },
  presetName: { color: colors.textPrimary, fontSize: 15 },
  swatchGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: "transparent",
  },
  swatchActive: { borderColor: colors.textPrimary },
  hint: { color: colors.textDim, fontSize: 13 },
  settingRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  settingMain: { flex: 1, gap: spacing.xs },
  settingTitle: { color: colors.textPrimary, fontSize: 16 },
});
