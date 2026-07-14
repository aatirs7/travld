import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type Tier = "sm" | "md" | "lg";

/** Approximate native tab bar height; combine with insets.bottom for scroll pads.
 *  Generous so content never sits under the bar on any device. */
export const TAB_BAR_HEIGHT = 64;

/**
 * The single source of layout truth. No screen computes its own dimensions.
 * Tiers snap type/spacing to device classes instead of linearly scaling off
 * width. `isShort` (SE) is the signal to drop decorative padding, not shrink
 * content. See the responsive-layout standard.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const tier: Tier = width < 380 ? "sm" : width < 420 ? "md" : "lg";
  const isShort = height < 700;

  const pick = <T,>(v: Record<Tier, T>): T => v[tier];

  return {
    width,
    height,
    tier,
    isShort,
    insets,
    pick,

    gutter: pick({ sm: 16, md: 20, lg: 24 }),
    cardPad: pick({ sm: 14, md: 18, lg: 22 }),
    sectionGap: isShort ? 16 : pick({ sm: 20, md: 24, lg: 28 }),

    heroNumber: pick({ sm: 52, md: 64, lg: 72 }),
    heroLabel: pick({ sm: 13, md: 15, lg: 16 }),
    listRow: pick({ sm: 52, md: 56, lg: 60 }),

    /** paddingBottom for scroll content so the tab bar never hides the last row. */
    scrollPadBottom: insets.bottom + TAB_BAR_HEIGHT + 24,
  };
}
