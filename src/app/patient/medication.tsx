import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Screen } from '@/components';
import { CURRENT_PATIENT_ID, medicationLogsForPatient } from '@/mock/data';
import { MedicationLog } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';
import { clockTime, timeAgo } from '@/utils/time';

/** Quick-add a medication taken now; lists recent medication entries. */
export default function MedicationScreen() {
  const [name, setName] = useState('');
  const [logs, setLogs] = useState<MedicationLog[]>(() =>
    medicationLogsForPatient(CURRENT_PATIENT_ID),
  );

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    // TODO(backend): insert into medication_logs.
    setLogs((prev) => [
      {
        id: `local-${Date.now()}`,
        patient_id: CURRENT_PATIENT_ID,
        medication_name: trimmed,
        taken_at: new Date().toISOString(),
      },
      ...prev,
    ]);
    setName('');
  };

  return (
    <Screen>
      <Text style={styles.title}>Medicine</Text>
      <Text style={styles.subtitle}>Log a medication you just took.</Text>

      <Card style={styles.addCard}>
        <TextInput
          style={styles.input}
          placeholder="Medication name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        <Button title="Add (taken now)" size="lg" disabled={!name.trim()} onPress={add} />
      </Card>

      <Text style={styles.sectionTitle}>Recent</Text>
      <Card style={styles.list}>
        {logs.length === 0 ? (
          <Text style={styles.empty}>No medications logged yet.</Text>
        ) : (
          logs.map((log, i) => (
            <View key={log.id} style={[styles.row, i < logs.length - 1 && styles.rowBorder]}>
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{log.medication_name}</Text>
                <Text style={styles.rowClock}>{clockTime(log.taken_at)}</Text>
              </View>
              <Text style={styles.rowTime}>{timeAgo(log.taken_at)}</Text>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  addCard: { gap: spacing.md },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionTitle: { ...typography.heading, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  list: { paddingVertical: spacing.xs },
  empty: { ...typography.body, color: colors.textMuted, paddingVertical: spacing.md },
  row: { paddingVertical: spacing.md },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { ...typography.bodyStrong, color: colors.text },
  rowClock: { ...typography.label, color: colors.text },
  rowTime: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
