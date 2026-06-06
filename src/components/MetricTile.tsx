import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

type MetricTileProps = {
  label: string;
  /** 0–100 value. */
  value: number;
  /** Accent color for the bar + value. */
  accent: string;
  /** Optional caption under the value, e.g. "vs. yesterday". */
  caption?: string;
};

/**
 * A single metric tile (Fatigue / Attention / Mood). Shows a 0–100 value and
 * a proportional fill bar. Used on both the patient home and caregiver detail.
 */
export function MetricTile({ label, value, accent, caption }: MetricTileProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={styles.tile}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: accent }]}>{clamped}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: accent }]} />
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
  value: { ...typography.display, fontSize: 34, lineHeight: 38 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  fill: { height: '100%', borderRadius: 4 },
  caption: { ...typography.caption, color: colors.textMuted },
});

export default MetricTile;
