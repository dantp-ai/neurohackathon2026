import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, Card, MetricTile, Screen, StatusRing } from '@/components';
import { activeEventForPatient, CURRENT_PATIENT } from '@/mock/data';
import { useSession } from '@/store/session';
import { colors, spacing, StatusLevel, typography } from '@/theme';
import { timeAgo } from '@/utils/time';

const STATUS_TITLE: Record<StatusLevel, string> = {
  good: 'Doing Well',
  warn: 'Take It Easy',
  bad: 'Needs Attention',
};

/** Patient home: a friendly "how am I doing" snapshot with the three metrics. */
export default function PatientHome() {
  const router = useRouter();
  const { user, signOut } = useSession();
  const patient = CURRENT_PATIENT;
  const activeEvent = activeEventForPatient(patient.user.id);

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.greeting}>Hello, {user?.display_name?.split(' ')[0] ?? 'there'}</Text>
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={styles.switch}>Switch</Text>
        </Pressable>
      </View>

      <View style={styles.ringWrap}>
        <StatusRing
          level={patient.status}
          title={STATUS_TITLE[patient.status]}
          subtitle={`Updated ${timeAgo(patient.lastUpdated)}`}
        />
      </View>

      {activeEvent ? (
        <Card style={styles.alertCard}>
          <Text style={styles.alertTitle}>We noticed something</Text>
          <Text style={styles.alertBody}>
            Your readings changed a little. Can you tell us how you’re feeling?
          </Text>
          <Button title="Check In" size="lg" onPress={() => router.push('/checkin')} />
        </Card>
      ) : null}

      <Text style={styles.sectionTitle}>How am I doing?</Text>
      <View style={styles.metrics}>
        <MetricTile label="Fatigue" value={patient.metrics.fatigue} accent={colors.fatigue} />
        <MetricTile label="Attention" value={patient.metrics.attention} accent={colors.attention} />
        <MetricTile label="Mood" value={patient.metrics.mood} accent={colors.mood} />
      </View>
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
  alertCard: { gap: spacing.md, marginBottom: spacing.xl, borderColor: colors.statusWarn },
  alertTitle: { ...typography.heading, color: colors.text },
  alertBody: { ...typography.body, color: colors.textMuted },
  sectionTitle: { ...typography.heading, color: colors.text, marginBottom: spacing.md },
  metrics: { flexDirection: 'row', gap: spacing.md },
});
