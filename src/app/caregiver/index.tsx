import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, Screen, StatusPill } from '@/components';
import { PATIENTS, PatientSummary } from '@/mock/data';
import { useSession } from '@/store/session';
import { colors, spacing, StatusLevel, typography } from '@/theme';
import { timeAgo } from '@/utils/time';

const STATUS_LABEL: Record<StatusLevel, string> = {
  good: 'Stable',
  warn: 'Watch',
  bad: 'Urgent',
};

/** Caregiver home: a card per monitored patient with status + alert badge. */
export default function CaregiverHome() {
  const router = useRouter();
  const { user, signOut } = useSession();

  return (
    <Screen>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>Patients</Text>
          <Text style={styles.subtitle}>{user?.display_name}</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={styles.switch}>Switch</Text>
        </Pressable>
      </View>

      <View style={styles.list}>
        {PATIENTS.map((p) => (
          <PatientCard
            key={p.user.id}
            patient={p}
            onPress={() => router.push(`/caregiver/patient/${p.user.id}`)}
          />
        ))}
      </View>
    </Screen>
  );
}

function PatientCard({ patient, onPress }: { patient: PatientSummary; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <Avatar name={patient.user.display_name} uri={patient.user.avatar_url} size={52} />
      <View style={styles.cardMain}>
        <View style={styles.cardTopRow}>
          <Text style={styles.name}>{patient.user.display_name}</Text>
          {patient.hasUnacknowledgedAlert ? <View style={styles.alertDot} /> : null}
        </View>
        <Text style={styles.updated}>Updated {timeAgo(patient.lastUpdated)}</Text>
      </View>
      <StatusPill level={patient.status} label={STATUS_LABEL[patient.status]} />
    </Card>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  switch: { ...typography.label, color: colors.primary },
  list: { gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardMain: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.heading, color: colors.text },
  alertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.statusBad },
  updated: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
