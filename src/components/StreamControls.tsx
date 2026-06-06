import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from './Card';
import { colors, radius, spacing, typography } from '@/theme';

export type StreamSource = 'live' | 'simulated';

type Props = {
  eeg: boolean;
  vitals: boolean;
  source: StreamSource;
  onToggleEeg: () => void;
  onToggleVitals: () => void;
  onSource: (s: StreamSource) => void;
};

/**
 * Data-streaming controls — start/stop EEG and vitals independently, choose a
 * source. Controlled: the parent owns the state so it can drive the live
 * Last-hour / Vitals waveforms (and, later, the pipeline daemon) off the toggles.
 */
export function StreamControls({ eeg, vitals, source, onToggleEeg, onToggleVitals, onSource }: Props) {
  const { t } = useTranslation();

  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={styles.title}>{t('stream.title')}</Text>

      <StreamRow label={t('stream.eeg')} on={eeg} onToggle={onToggleEeg} />
      <StreamRow label={t('stream.heartRate')} on={vitals} onToggle={onToggleVitals} />

      <View style={styles.sourceRow}>
        <Text style={styles.sourceLabel}>{t('stream.source')}</Text>
        {(['live', 'simulated'] as StreamSource[]).map((s) => (
          <Pressable key={s} onPress={() => onSource(s)} style={[styles.chip, source === s && styles.chipOn]}>
            <Text style={[styles.chipText, source === s && styles.chipTextOn]}>
              {t(s === 'live' ? 'stream.live' : 'stream.simulated')}
            </Text>
          </Pressable>
        ))}
      </View>
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
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sourceLabel: { ...typography.label, color: colors.textMuted, marginRight: spacing.xs },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt },
  chipOn: { backgroundColor: colors.primary },
  chipText: { ...typography.label, color: colors.textMuted },
  chipTextOn: { color: colors.textInverse },
});

export default StreamControls;
