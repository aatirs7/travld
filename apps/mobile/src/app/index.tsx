import { percentOfWorld, UN_COUNTRY_DENOMINATOR } from '@travld/core';
import { colors, spacing, typography } from '@travld/ui';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Phase 0 placeholder for the Map tab's "In Total" hero. Numbers are hard-coded
// here; Phase 1 wires them to derived stats from the visit log. This screen
// exists to prove @travld/core + @travld/ui resolve through the monorepo and to
// lock in the black/amber aesthetic.
export default function MapScreen() {
  const countries = 0;
  const pct = percentOfWorld(countries);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>
        <Text style={styles.wordmark}>travld</Text>
        <View style={styles.hero}>
          <Text style={styles.number}>{countries}</Text>
          <Text style={styles.pct}>{pct}%</Text>
        </View>
        <Text style={styles.label}>
          COUNTRIES · {countries} / {UN_COUNTRY_DENOMINATOR}
        </Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  wordmark: {
    color: colors.mint,
    fontSize: 24,
    fontWeight: '200',
    letterSpacing: 6,
    textTransform: 'lowercase',
  },
  hero: { flexDirection: 'row', alignItems: 'flex-start' },
  number: {
    fontSize: typography.hero.fontSize,
    fontWeight: typography.hero.fontWeight,
    color: colors.mint,
    letterSpacing: typography.hero.letterSpacing,
  },
  pct: { fontSize: 20, color: colors.mint, marginTop: spacing.sm },
  label: { ...typography.label, textTransform: 'uppercase' },
});
