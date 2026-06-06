/**
 * Clinician label-review: a read-only history of the labels given to a patient
 * over time (time → label → source), from the patient's check-in or the
 * clinician. You can edit a label here, but not add one (adding happens in the
 * labeling section under the embedding map).
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Card } from './Card';
import { useSegmentLabels } from '@/hooks/useSegmentLabels';
import { categoryKey } from '@/lib/labels';
import { colors, radius, spacing, typography } from '@/theme';
import { clockTime, timeAgo } from '@/utils/time';

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
    <Card style={{ gap: spacing.md }}>
      <Text style={styles.title}>{t('labels.history')}</Text>
      {labels.length === 0 ? (
        <Text style={styles.empty}>{t('labels.none')}</Text>
      ) : (
        labels.map((l) => {
          const editing = editId === l.id;
          return (
            <View key={l.id} style={styles.row}>
              <View style={styles.timeCol}>
                <Text style={styles.time}>{clockTime(l.created_at)}</Text>
                <Text style={styles.ago}>{timeAgo(l.created_at)}</Text>
              </View>
              <View style={styles.labelCol}>
                {editing ? (
                  <TextInput
                    style={styles.input}
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    onSubmitEditing={() => {
                      update(l.id, draft);
                      setEditId(null);
                    }}
                    returnKeyType="done"
                  />
                ) : (
                  <Text style={styles.category}>{display(l.category)}</Text>
                )}
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: l.source === 'patient' ? '#EAF6EE' : '#EFF4FF' },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: l.source === 'patient' ? colors.statusGood : colors.primary },
                    ]}
                  >
                    {t(l.source === 'patient' ? 'labels.sourcePatient' : 'labels.sourceClinician')}
                  </Text>
                </View>
              </View>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  if (editing) {
                    update(l.id, draft);
                    setEditId(null);
                  } else {
                    setDraft(l.category);
                    setEditId(l.id);
                  }
                }}
              >
                <Text style={styles.edit}>{editing ? t('common.done') : t('common.edit')}</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.text },
  empty: { ...typography.body, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  timeCol: { width: 76 },
  time: { ...typography.bodyStrong, color: colors.text },
  ago: { ...typography.caption, color: colors.textMuted },
  labelCol: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  category: { ...typography.body, color: colors.text },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 120,
  },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { ...typography.caption, fontWeight: '700' },
  edit: { ...typography.label, color: colors.primary },
});

export default LabelsReview;
