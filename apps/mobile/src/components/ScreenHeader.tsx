import { colors, spacing, Text, useLayout } from "@travld/ui";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

/**
 * Standard screen header: a centered title with symmetric left/right slots so
 * the title is always truly centered regardless of which buttons are present.
 */
export function ScreenHeader({
  title,
  left,
  right,
}: {
  title: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const L = useLayout();
  return (
    <View style={[styles.row, { paddingTop: L.insets.top + spacing.sm, paddingHorizontal: L.gutter }]}>
      <View style={styles.side}>{left}</View>
      <Text variant="hero" numberOfLines={1} style={styles.title}>
        {title}
      </Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingBottom: spacing.sm },
  side: { width: 72, justifyContent: "center" },
  right: { alignItems: "flex-end" },
  title: { flex: 1, textAlign: "center", fontSize: 20, fontWeight: "700", color: colors.textPrimary },
});
