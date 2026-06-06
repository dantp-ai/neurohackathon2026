import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { StatusPill } from './StatusPill';
import { Label } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';

type LabelReviewCardProps = {
  label: Label;
};

/** Editable form values derived from a Label (medications flattened to text). */
interface Draft {
  activity: string;
  medications: string;
  subjective_state: string;
  event_type: string;
  resolution: string;
}

const toDraft = (l: Label): Draft => ({
  activity: l.activity,
  medications: l.medications.join(', '),
  subjective_state: l.subjective_state,
  event_type: l.event_type,
  resolution: l.resolution,
});

const FIELDS: { key: keyof Draft; label: string }[] = [
  { key: 'activity', label: 'Activity' },
  { key: 'medications', label: 'Medications' },
  { key: 'subjective_state', label: 'Subjective State' },
  { key: 'event_type', label: 'Event Type' },
  { key: 'resolution', label: 'Resolution' },
];

/**
 * The caregiver's label review unit: shows an auto-extracted label, lets the
 * caregiver edit any field, and confirms it as ground truth.
 */
export function LabelReviewCard({ label }: LabelReviewCardProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(label));
  const [editing, setEditing] = useState(false);
  const [confirmed, setConfirmed] = useState(label.confirmed_by_caregiver);

  const confirm = () => {
    // TODO(backend): update labels row (fields + confirmed_by_caregiver=true).
    setConfirmed(true);
    setEditing(false);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Extracted Label</Text>
        {confirmed ? (
          <StatusPill level="good" label="Confirmed" />
        ) : (
          <View style={styles.confBadge}>
            <Text style={styles.confText}>
              {label.extraction_method === 'llm_auto' ? 'AI' : 'Manual'} ·{' '}
              {Math.round(label.confidence * 100)}%
            </Text>
          </View>
        )}
      </View>

      <View style={styles.fields}>
        {FIELDS.map((f) => (
          <View key={f.key} style={styles.field}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={draft[f.key]}
                onChangeText={(v) => setDraft((d) => ({ ...d, [f.key]: v }))}
                multiline
              />
            ) : (
              <Text style={styles.fieldValue}>{draft[f.key] || '—'}</Text>
            )}
          </View>
        ))}
      </View>

      {!confirmed && (
        <View style={styles.actions}>
          <Button
            title={editing ? 'Cancel' : 'Edit'}
            variant="secondary"
            size="md"
            fullWidth={false}
            onPress={() => {
              if (editing) setDraft(toDraft(label));
              setEditing((e) => !e);
            }}
            style={styles.actionBtn}
          />
          <Button
            title="Confirm"
            size="md"
            fullWidth={false}
            onPress={confirm}
            style={styles.actionBtn}
          />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.lg },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typography.heading, color: colors.text },
  confBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  confText: { ...typography.label, color: colors.textMuted },
  fields: { gap: spacing.md },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.label, color: colors.textMuted },
  fieldValue: { ...typography.body, color: colors.text },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actions: { flexDirection: 'row', gap: spacing.md, justifyContent: 'flex-end' },
  actionBtn: { minWidth: 110 },
});

export default LabelReviewCard;
