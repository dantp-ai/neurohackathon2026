import { StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import { StatusPill } from './StatusPill';
import { colors, spacing, statusColors, StatusLevel, typography } from '@/theme';

type VitalCardProps = {
  /** Emoji/icon glyph, e.g. '❤️'. */
  icon: string;
  label: string;
  value: number;
  unit: string;
  status: StatusLevel;
  statusLabel: string;
  /** Optional recent readings for a mini trend line. */
  trend?: number[];
};

/**
 * A wearable-vital card (heart rate today; SpO2 / temperature later reuse this).
 * Distinct from MetricTile because vitals have real units and ranges, not a
 * 0–100 scale.
 */
export function VitalCard({ icon, label, value, unit, status, statusLabel, trend }: VitalCardProps) {
  const tint = statusColors[status];
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.icon}>{icon}</Text>
          <View>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.valueRow}>
              <Text style={[styles.value, { color: tint.fg }]}>{value}</Text>
              <Text style={styles.unit}>{unit}</Text>
            </View>
          </View>
        </View>
        <StatusPill level={status} label={statusLabel} />
      </View>
      {trend && trend.length > 1 ? <Sparkline values={trend} color={tint.fg} /> : null}
    </Card>
  );
}

/** Minimal bar sparkline, scaled to the series' own min/max. */
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return (
    <View style={styles.spark}>
      {values.map((v, i) => (
        <View key={i} style={styles.sparkCol}>
          <View
            style={[
              styles.sparkBar,
              { height: `${25 + ((v - min) / range) * 75}%`, backgroundColor: color },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { fontSize: 32 },
  label: { ...typography.label, color: colors.textMuted },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  value: { ...typography.display, fontSize: 34, lineHeight: 38 },
  unit: { ...typography.bodyStrong, color: colors.textMuted },
  spark: { flexDirection: 'row', alignItems: 'flex-end', height: 40, gap: 3 },
  sparkCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  sparkBar: { width: '100%', borderRadius: 2, minHeight: 3 },
});

export default VitalCard;
