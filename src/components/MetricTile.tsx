import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

type MetricTileProps = {
  label: string;
  /** 1–5 score (5 = best). */
  score: number;
  /** Accent color for the value + filled pips. */
  accent: string;
  caption?: string;
};

/**
 * A single metric tile (Fatigue / Attention / Relaxation) on a 1–5 scale where
 * 5 is best. Shows the score and five pips.
 */
export function MetricTile({ label, score, accent, caption }: MetricTileProps) {
  const s = Math.max(1, Math.min(5, Math.round(score)));
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.scoreRow}>
        <Text style={[styles.value, { color: accent }]}>{s}</Text>
        <Text style={styles.outOf}>/5</Text>
      </View>
      <View style={styles.pips}>
        {[1, 2, 3, 4, 5].map((p) => (
          <View
            key={p}
            style={[styles.pip, { backgroundColor: p <= s ? accent : colors.surfaceAlt }]}
          />
        ))}
      </View>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  label: { ...typography.label, color: colors.textMuted },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  value: { ...typography.display, fontSize: 34, lineHeight: 38 },
  outOf: { ...typography.label, color: colors.textMuted, marginLeft: 2 },
  pips: { flexDirection: 'row', gap: 4, marginTop: spacing.xs },
  pip: { flex: 1, height: 6, borderRadius: 3 },
  caption: { ...typography.caption, color: colors.textMuted },
});

export default MetricTile;
