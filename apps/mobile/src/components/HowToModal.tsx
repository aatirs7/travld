import { colors, radius, spacing, Text, useLayout } from "@travld/ui";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

const STEPS: { icon: string; title: string; body: string }[] = [
  {
    icon: "🗺️",
    title: "Mark countries",
    body: "Tap any country on the map to mark it visited. Tap again to unmark.",
  },
  {
    icon: "📍",
    title: "States, cities & more",
    body: "Tap a country in “My Countries” to open it, then use the States and Cities tabs — tap a state or city to mark it. Or hit ＋ and search any place to add it.",
  },
  {
    icon: "🧳",
    title: "Trips",
    body: "Group visits into named trips. When you add a place, pick a trip (or make a new one). See routes, stats, and companions per trip.",
  },
  {
    icon: "👥",
    title: "Friends & compare",
    body: "Follow people, see their trips in your feed, climb the leaderboard, and open Compare to overlay your maps.",
  },
  {
    icon: "📊",
    title: "Stats",
    body: "Your travel broken down by continent, purpose, distance from home, and over time.",
  },
];

export function HowToModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const L = useLayout();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={{
            paddingTop: L.insets.top + spacing.xl,
            paddingHorizontal: L.gutter,
            paddingBottom: L.insets.bottom + spacing.xl,
            gap: spacing.lg,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text variant="hero" style={styles.wordmark}>travld</Text>
          <Text variant="hero" style={styles.title}>How it works</Text>

          {STEPS.map((s) => (
            <View key={s.title} style={styles.step}>
              <Text variant="body" style={styles.icon}>{s.icon}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="body" style={styles.stepTitle}>{s.title}</Text>
                <Text variant="body" style={styles.stepBody}>{s.body}</Text>
              </View>
            </View>
          ))}

          <Pressable onPress={onClose} style={styles.cta}>
            <Text variant="body" style={styles.ctaText}>Got it</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  wordmark: { color: colors.mint, fontSize: 22, fontWeight: "200", letterSpacing: 6, textAlign: "center" },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: "700", textAlign: "center" },
  step: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start", backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.md },
  icon: { fontSize: 26 },
  stepTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: "700" },
  stepBody: { color: colors.textDim, fontSize: 15, lineHeight: 21 },
  cta: { alignSelf: "center", paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.pill, backgroundColor: colors.mint, marginTop: spacing.sm },
  ctaText: { color: colors.bg, fontWeight: "700", fontSize: 16 },
});
