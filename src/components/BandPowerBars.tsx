import { StyleSheet, Text, View } from 'react-native';

import { BandPowers } from '@/types';
import { bandColors, colors, spacing, typography } from '@/theme';

type BandPowerBarsProps = {
  powers: BandPowers;
  /** Bar area height in px. */
  height?: number;
};

const BANDS: { key: keyof BandPowers; symbol: string; name: string }[] = [
  { key: 'delta', symbol: 'δ', name: 'Delta' },
  { key: 'theta', symbol: 'θ', name: 'Theta' },
  { key: 'alpha', symbol: 'α', name: 'Alpha' },
  { key: 'beta', symbol: 'β', name: 'Beta' },
  { key: 'gamma', symbol: 'γ', name: 'Gamma' },
];

/**
 * Live EEG spectrum: relative power per frequency band. Bars are scaled to the
 * strongest band so the shape is readable regardless of absolute magnitudes.
 */
export function BandPowerBars({ powers, height = 96 }: BandPowerBarsProps) {
  const max = Math.max(...BANDS.map((b) => powers[b.key])) || 1;
  return (
    <View>
      <View style={[styles.bars, { height }]}>
        {BANDS.map((b) => {
          const value = powers[b.key];
          return (
            <View key={b.key} style={styles.col}>
              <Text style={styles.pct}>{Math.round(value * 100)}%</Text>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { height: `${(value / max) * 100}%`, backgroundColor: bandColors[b.key] },
                  ]}
                />
              </View>
              <Text style={[styles.symbol, { color: bandColors[b.key] }]}>{b.symbol}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  col: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: spacing.xs },
  pct: { ...typography.caption, color: colors.textMuted, fontSize: 12 },
  track: { flex: 1, width: '70%', justifyContent: 'flex-end' },
  fill: { width: '100%', borderRadius: 4, minHeight: 4 },
  symbol: { ...typography.bodyStrong, fontSize: 18 },
});

export default BandPowerBars;
