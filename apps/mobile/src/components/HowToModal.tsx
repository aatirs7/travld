import { type ThemeColors, radius, spacing, Text, useLayout } from "@travld/ui";
import { useAppColors } from "@/lib/app-theme";
import { SymbolView, type SFSymbol } from "expo-symbols";
import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

const STEPS: { icon: SFSymbol; title: string; body: string }[] = [
  {
    icon: "globe.americas.fill",
    title: "Mark countries",
    body: "Tap any country on the map to mark it visited. Tap again to unmark.",
  },
  {
    icon: "mappin.and.ellipse",
    title: "States & cities",
    body: "Tap a country in “My Countries”, then use the States and Cities tabs to mark them — or hit ＋ to search any place.",
  },
  {
    icon: "suitcase.fill",
    title: "Trips",
    body: "Group visits into named trips with routes, dates and companions.",
  },
  {
    icon: "person.2.fill",
    title: "Friends & compare",
    body: "Follow people, see their trips, and overlay your maps in Compare.",
  },
  {
    icon: "chart.bar.fill",
    title: "Stats",
    body: "Your travel by continent, purpose, distance and over time.",
  },
];

export function HowToModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const L = useLayout();
  const tc = useAppColors();
  const styles = useMemo(() => makeStyles(tc), [tc]);
  const [step, setStep] = useState(0);
  const s = STEPS[step]!;
  const last = step === STEPS.length - 1;
  const cardW = Math.min(L.width - spacing.xl * 2, 360);

  const next = () => (last ? (setStep(0), onClose()) : setStep((i) => i + 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { width: cardW }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.skip}>
            <Text variant="body" style={styles.skipText}>Skip</Text>
          </Pressable>

          <View style={styles.iconWrap}>
            <SymbolView name={s.icon} size={44} tintColor={tc.mint} resizeMode="scaleAspectFit" />
          </View>
          <Text variant="hero" style={styles.title}>{s.title}</Text>
          <Text variant="body" style={styles.body}>{s.body}</Text>

          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
            ))}
          </View>

          <Pressable onPress={next} style={styles.cta}>
            <Text variant="body" style={styles.ctaText}>{last ? "Got it" : "Next"}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (tc: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: tc.surface,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  skip: { position: "absolute", top: spacing.md, right: spacing.md },
  skipText: { color: tc.textDim, fontSize: 14 },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: tc.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  title: { color: tc.textPrimary, fontSize: 22, fontWeight: "700", textAlign: "center" },
  body: { color: tc.textDim, fontSize: 15, lineHeight: 21, textAlign: "center", minHeight: 64 },
  dots: { flexDirection: "row", gap: 6, marginTop: spacing.xs },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: tc.grey },
  dotActive: { backgroundColor: tc.mint, width: 20 },
  cta: {
    alignSelf: "stretch",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: tc.mint,
    marginTop: spacing.sm,
  },
  ctaText: { color: tc.bg, fontWeight: "700", fontSize: 16 },
});
