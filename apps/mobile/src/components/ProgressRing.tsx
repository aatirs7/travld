import { colors, Text } from "@travld/ui";
import { View } from "react-native";
import Svg, { Circle } from "react-native-svg";

interface Props {
  value: number;
  total: number;
  label: string;
  color?: string;
  size?: number;
}

export function ProgressRing({ value, total, label, color = colors.mint, size = 120 }: Props) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(value / total, 1) : 0;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="hero" style={{ color: colors.textPrimary, fontSize: 24, fontWeight: "700" }}>
        {value}/{total}
      </Text>
      <Text variant="hero" style={{ color: colors.textDim, fontSize: 12, textTransform: "uppercase" }}>
        {label}
      </Text>
    </View>
  );
}
