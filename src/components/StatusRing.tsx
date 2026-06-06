import { StyleSheet, Text, View } from 'react-native';

import { colors, statusColors, StatusLevel, typography } from '@/theme';

type StatusRingProps = {
  level: StatusLevel;
  /** Optional caption shown BELOW the ring (not inside it). */
  subtitle?: string;
  size?: number;
};

/**
 * Large circular wellness indicator. The ring is a pure color signal (no text
 * inside — that got clipped); any label goes underneath.
 */
export function StatusRing({ level, subtitle, size = 200 }: StatusRingProps) {
  const c = statusColors[level];
  const ringStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: size * 0.09,
    borderColor: c.fg,
    backgroundColor: c.bg,
  };
  return (
    <View style={styles.wrap}>
      <View style={[styles.ring, ringStyle]}>
        <View style={[styles.dot, { backgroundColor: c.fg, width: size * 0.18, height: size * 0.18, borderRadius: size * 0.09 }]} />
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  ring: { alignItems: 'center', justifyContent: 'center' },
  dot: {},
  subtitle: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
});

export default StatusRing;
