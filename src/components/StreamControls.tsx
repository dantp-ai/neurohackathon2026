import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import { colors, radius, spacing, typography } from '@/theme';

type Props = {
  eeg: boolean;
  vitals: boolean;
  onToggleEeg: () => void;
  onToggleVitals: () => void;
};

/**
 * Data-streaming controls — start/stop EEG and vitals independently. The source
 * is always simulated (neurodsp) in the background, so there's no source picker.
 * Controlled: the parent owns the state so it can drive the live waveforms.
 */
export function StreamControls({ eeg, vitals, onToggleEeg, onToggleVitals }: Props) {
  const { t } = useTranslation();
  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={styles.title}>{t('stream.title')}</Text>
      <StreamRow label={t('stream.eeg')} on={eeg} onToggle={onToggleEeg} />
      <StreamRow label={t('stream.heartRate')} on={vitals} onToggle={onToggleVitals} />
    </Card>
  );
}

function StreamRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <View style={[styles.dot, { backgroundColor: on ? colors.statusGood : colors.textMuted }]} />
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowState}>{on ? t('stream.streaming') : t('stream.stopped')}</Text>
      </View>
      <Pressable onPress={onToggle} style={[styles.btn, { borderColor: on ? colors.statusBad : colors.primary }]}>
        <Text style={[styles.btnText, { color: on ? colors.statusBad : colors.primary }]}>
          {on ? t('stream.stop') : t('stream.start')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { ...typography.bodyStrong, color: colors.text },
  rowState: { ...typography.caption, color: colors.textMuted },
  btn: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  btnText: { ...typography.label },
});

export default StreamControls;
