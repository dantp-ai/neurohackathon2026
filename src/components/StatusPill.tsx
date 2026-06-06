import { StyleSheet, Text, View } from 'react-native';

import { radius, spacing, statusColors, StatusLevel, typography } from '@/theme';

type StatusPillProps = {
  level: StatusLevel;
  label: string;
};

/** Small rounded status badge, e.g. "Resolved" / "Needs Follow-Up". */
export function StatusPill({ level, label }: StatusPillProps) {
  const c = statusColors[level];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <View style={[styles.dot, { backgroundColor: c.fg }]} />
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { ...typography.label },
});

export default StatusPill;
