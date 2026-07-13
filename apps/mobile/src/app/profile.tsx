import { mapThemePresets, type MapTheme } from "@travld/core";
import { colors, radius, spacing, typography } from "@travld/ui";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PassportMap } from "@/components/PassportMap";
import { useMapTheme } from "@/lib/map-theme-context";

// A compact swatch palette for the "visited" fill — real customization without a
// heavy color-wheel dependency. Land/water stay from the active theme.
const VISITED_SWATCHES = [
  "#00E08F", "#38EF7D", "#4EA8FF", "#5B8DEF", "#B18CFF", "#FF5D8F",
  "#FF9F0A", "#FFD60A", "#FF6B3D", "#FF4D4D", "#2EE6C9", "#FFFFFF",
];

// A tiny fixed "visited" set just for the live preview.
const PREVIEW = new Set(["US", "BR", "PK", "JP", "AU", "ZA", "FR", "EG"]);

export default function ProfileScreen() {
  const { theme, setTheme } = useMapTheme();

  const apply = (next: MapTheme) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void setTheme(next);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.h1}>Profile</Text>

          <Text style={styles.section}>Map Style</Text>
          <View style={styles.preview}>
            <PassportMap visited={PREVIEW} theme={theme} />
          </View>

          <Text style={styles.label}>PRESETS</Text>
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
                  <Text style={styles.presetName}>{p.name}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>VISITED COLOR</Text>
          <View style={styles.swatchGrid}>
            {VISITED_SWATCHES.map((hex) => {
              const active = hex.toLowerCase() === theme.visited.toLowerCase();
              return (
                <Pressable
                  key={hex}
                  onPress={() => apply({ ...theme, visited: hex })}
                  style={[
                    styles.swatch,
                    { backgroundColor: hex },
                    active && styles.swatchActive,
                  ]}
                />
              );
            })}
          </View>

          <Text style={styles.hint}>Changes save automatically and sync to your maps.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  scroll: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  h1: { ...typography.title, fontSize: 28, marginTop: spacing.sm },
  section: { ...typography.title, marginTop: spacing.sm },
  preview: {
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  label: { ...typography.label, textTransform: "uppercase", marginTop: spacing.sm },
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
  swatch: { width: 48, height: 48, borderRadius: radius.card, borderWidth: 2, borderColor: "transparent" },
  swatchActive: { borderColor: colors.textPrimary },
  hint: { color: colors.textDim, marginTop: spacing.sm },
});
