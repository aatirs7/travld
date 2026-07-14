import { Text as RNText, type TextProps as RNTextProps } from "react-native";
import { fontMono } from "./tokens";

export interface TextProps extends RNTextProps {
  /**
   * Dynamic Type variant. Caps the accessibility multiplier so large text never
   * destroys a card: hero/stat/tab labels 1.2, body/notes/rows 1.5, default 1.3.
   */
  variant?: "hero" | "body" | "default";
  /** Render in the system monospace family. Use for every figure (§2.3). */
  mono?: boolean;
}

const MULTIPLIER: Record<NonNullable<TextProps["variant"]>, number> = {
  hero: 1.2,
  body: 1.5,
  default: 1.3,
};

/**
 * The only Text every screen should import (never `react-native`'s Text).
 * Enforces a capped Dynamic Type multiplier at the source, and `mono` for figures.
 */
export function Text({ variant = "default", mono, maxFontSizeMultiplier, style, ...props }: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? MULTIPLIER[variant]}
      style={mono ? [{ fontFamily: fontMono }, style] : style}
      {...props}
    />
  );
}
