/**
 * Clinician label-review: a spreadsheet-style table of the labels given to a
 * patient over time — Time | Sample | Label | Source — from the patient's
 * check-in or the clinician. Each row shows the (fake) neurodsp sample that was
 * labeled. You can edit a label here, but not add one (adding happens under the
 * embedding map).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from './Card';
import { SampleWave } from './SampleWave';
import { useSegmentLabels } from '@/hooks/useSegmentLabels';
import { categoryKey } from '@/lib/labels';
import { colors, radius, spacing, typography } from '@/theme';
import { clockTime } from '@/utils/time';

export function LabelsReview({ displayName }: { displayName: string }) {
  const { t } = useTranslation();
  const { labels, loading, update } = useSegmentLabels(displayName);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const display = (cat: string) => {
    const k = categoryKey(cat);
    return k ? t(`labelCat.${k}`) : cat;
  };

  if (loading) return <Text style={styles.empty}>{t('common.loading')}</Text>;

  return (
    <Card style={styles.card}>
      <Text style={styles.title}>{t('labels.history')}</Text>

      <View style={styles.table}>
        {/* header */}
        <View style={[styles.row, styles.headerRow]}>
          <Text numberOfLines={1} style={[styles.cell, styles.colTime, styles.headerText]}>{t('labels.colTime')}</Text>
          <Text numberOfLines={1} style={[styles.cell, styles.colSample, styles.headerText]}>{t('labels.colSample')}</Text>
          <Text numberOfLines={1} style={[styles.cell, styles.colLabel, styles.headerText]}>{t('labels.colLabel')}</Text>
          <Text numberOfLines={1} style={[styles.cell, styles.colSource, styles.headerText, styles.cellLast]}>
            {t('labels.colSource')}
          </Text>
        </View>

        {labels.length === 0 ? (
          <Text style={styles.empty}>{t('labels.none')}</Text>
        ) : (
          labels.map((l, i) => {
            const editing = editId === l.id;
            const isPatient = l.source === 'patient';
            const waveColor = isPatient ? colors.statusGood : colors.primary;
            return (
              <View key={l.id} style={[styles.row, i % 2 === 1 && styles.rowAlt]}>
                <Text style={[styles.cell, styles.colTime, styles.timeText]}>{clockTime(l.created_at)}</Text>
                <View style={[styles.cell, styles.colSample]}>
                  <SampleWave seed={l.id} color={waveColor} width={48} height={20} />
                </View>
                <Pressable
                  style={[styles.cell, styles.colLabel]}
                  onPress={() => {
                    setDraft(l.category);
                    setEditId(l.id);
                  }}
                >
                  {editing ? (
                    <TextInput
                      style={styles.input}
                      value={draft}
                      onChangeText={setDraft}
                      autoFocus
                      onBlur={() => {
                        update(l.id, draft);
                        setEditId(null);
                      }}
                      onSubmitEditing={() => {
                        update(l.id, draft);
                        setEditId(null);
                      }}
                      returnKeyType="done"
                    />
                  ) : (
                    <Text style={styles.labelText}>{display(l.category)}</Text>
                  )}
                </Pressable>
                <View style={[styles.cell, styles.colSource, styles.cellLast]}>
                  <View style={[styles.badge, { backgroundColor: isPatient ? '#EAF6EE' : '#EFF4FF' }]}>
                    <Text style={[styles.badgeText, { color: isPatient ? colors.statusGood : colors.primary }]}>
                      {t(isPatient ? 'labels.sourcePatient' : 'labels.sourceClinician')}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>
      <Text style={styles.hint}>{t('labels.tapHint')}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  title: { ...typography.heading, color: colors.text },
  empty: { ...typography.body, color: colors.textMuted, padding: spacing.md },
  hint: { ...typography.caption, color: colors.textMuted },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
    maxWidth: 520,
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    minHeight: 28,
  },
  rowAlt: { backgroundColor: colors.surfaceAlt },
  headerRow: { backgroundColor: colors.surfaceAlt },
  cell: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    justifyContent: 'center',
  },
  cellLast: { borderRightWidth: 0 },
  colTime: { width: 54 },
  colSample: { width: 74, alignItems: 'center' },
  colLabel: { flex: 1 },
  colSource: { width: 92, alignItems: 'flex-start' },
  headerText: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  timeText: { ...typography.caption, color: colors.text, fontVariant: ['tabular-nums'] },
  labelText: { ...typography.body, color: colors.text, fontWeight: '600' },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { ...typography.caption, fontWeight: '700' },
});

export default LabelsReview;
