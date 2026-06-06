import { StyleSheet, Text, View } from 'react-native';

import { colors, statusColors, StatusLevel, typography } from '@/theme';

type StatusRingProps = {
  level: StatusLevel;
  /** Big word inside the ring, e.g. "Good". */
  title: string;
  /** Smaller line under the title, e.g. "Updated 2 min ago". */
  subtitle?: string;
  size?: number;
};

/**
 * Large circular wellness indicator for the patient home screen.
 * Dependency-free (no SVG): a thick colored ring with a soft tinted center.
 */
export function StatusRing({ level, title, subtitle, size = 220 }: StatusRingProps) {
  const c = statusColors[level];
  const ringStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: size * 0.08,
    borderColor: c.fg,
    backgroundColor: c.bg,
  };
  return (
    <View style={styles.wrap}>
      <View style={[styles.ring, ringStyle]}>
        <Text style={[styles.title, { color: c.fg }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.display, textAlign: 'center' },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
});

export default StatusRing;
