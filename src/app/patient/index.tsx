import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, MetricTile, Screen, StatusRing, TextField, VitalCard } from '@/components';
import { CURRENT_PATIENT, heartRateFor, scoresFor } from '@/mock/data';
import { useSession } from '@/store/session';
import { CheckinResponseValue } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { timeAgo } from '@/utils/time';

const FEELINGS: { value: CheckinResponseValue; label: string }[] = [
  { value: 'ok', label: "I'm okay" },
  { value: 'not_great', label: 'Not great' },
  { value: 'help', label: 'I need help' },
];

/** Patient home: status, a check-in you can always use, and current readings. */
export default function PatientHome() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const patient = CURRENT_PATIENT;
  const scores = scoresFor(patient.metrics);
  const hr = heartRateFor(patient.user.id);

  const [feeling, setFeeling] = useState<CheckinResponseValue | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const submit = () => {
    // TODO(backend): write checkin_responses row.
    setSent(true);
    setNote('');
    setFeeling(null);
  };

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.greeting}>Hello, {user?.display_name?.split(' ')[0] ?? 'there'}</Text>
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={styles.switch}>Sign out</Text>
        </Pressable>
      </View>

      <View style={styles.ringWrap}>
        <StatusRing level={patient.status} subtitle={`Updated ${timeAgo(patient.lastUpdated)}`} />
      </View>

      <Card style={styles.checkinCard}>
        <Text style={styles.checkinTitle}>Check-in</Text>
        <Text style={styles.checkinPrompt}>
          How are you feeling right now? Please report any symptoms.
        </Text>
        <View style={styles.feelingRow}>
          {FEELINGS.map((f) => {
            const active = feeling === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setFeeling(f.value)}
                style={[styles.feelingBtn, active && styles.feelingBtnActive]}
              >
                <Text style={[styles.feelingLabel, active && styles.feelingLabelActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextField
          label="Describe if anything is happening"
          value={note}
          onChangeText={setNote}
          placeholder="e.g. I feel a little dizzy"
          multiline
          style={styles.noteInput}
        />
        <Button
          title="Send to care team"
          size="lg"
          disabled={!feeling && !note.trim()}
          onPress={submit}
        />
        {sent ? <Text style={styles.sentNote}>Thank you — your care team has been updated.</Text> : null}
      </Card>

      <Text style={styles.sectionTitle}>Current readings</Text>
      <View style={styles.metrics}>
        <MetricTile label="Energy" score={scores.fatigue} accent={colors.fatigue} />
        <MetricTile label="Attention" score={scores.attention} accent={colors.attention} />
        <MetricTile label="Relaxation" score={scores.relaxation} accent={colors.relaxation} />
      </View>

      <Text style={[styles.sectionTitle, styles.vitalsTitle]}>Vitals</Text>
      <VitalCard
        icon="❤️"
        label="Heart Rate"
        value={hr.value}
        unit="bpm"
        status={hr.status}
        statusLabel={hr.label}
        trend={hr.trend}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  greeting: { ...typography.title, color: colors.text },
  switch: { ...typography.label, color: colors.primary },
  ringWrap: { alignItems: 'center', marginVertical: spacing.lg },
  checkinCard: {
    gap: spacing.md,
    marginBottom: spacing.xl,
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: '#F2F8FF',
  },
  checkinTitle: { ...typography.heading, color: colors.primary },
  checkinPrompt: { ...typography.body, color: colors.text },
  feelingRow: { flexDirection: 'row', gap: spacing.sm },
  feelingBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  feelingBtnActive: { borderColor: colors.primary, backgroundColor: colors.surface },
  feelingLabel: { ...typography.label, color: colors.textMuted, textAlign: 'center' },
  feelingLabelActive: { color: colors.primary },
  noteInput: { minHeight: 64, textAlignVertical: 'top' },
  sentNote: { ...typography.caption, color: colors.statusGood },
  sectionTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.md },
  vitalsTitle: { marginTop: spacing.xl },
  metrics: { flexDirection: 'row', gap: spacing.md },
});
