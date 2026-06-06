import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Card, Screen, StatusPill } from '@/components';
import { PATIENTS, PatientSummary, scoresFor } from '@/mock/data';
import { useSession } from '@/store/session';
import { colors, spacing, StatusLevel, typography } from '@/theme';
import { timeAgo } from '@/utils/time';

const STATUS_KEY: Record<StatusLevel, string> = {
  good: 'status.stable',
  warn: 'status.watch',
  bad: 'status.urgent',
};

/** Caregiver home: a card per monitored patient with status + alert badge. */
export default function CaregiverHome() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user, signOut } = useSession();

  return (
    <Screen>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.title}>{t('common.patients')}</Text>
          <Text style={styles.subtitle}>{user?.display_name}</Text>
        </View>
        <Pressable onPress={signOut} hitSlop={8}>
          <Text style={styles.switch}>{t('common.signOut')}</Text>
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
  const { t } = useTranslation();
  const scores = scoresFor(patient.metrics);
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar name={patient.user.display_name} uri={patient.user.avatar_url} size={52} />
        <View style={styles.cardMain}>
          <View style={styles.cardTopRow}>
            <Text style={styles.name}>{patient.user.display_name}</Text>
            {patient.hasUnacknowledgedAlert ? <View style={styles.alertDot} /> : null}
          </View>
          <Text style={styles.updated}>{t('caregiver.updated', { time: timeAgo(patient.lastUpdated) })}</Text>
        </View>
        <StatusPill level={patient.status} label={t(STATUS_KEY[patient.status])} />
      </View>
      <View style={styles.metricsRow}>
        <MiniMetric label={t('metrics.energy')} score={scores.fatigue} accent={colors.fatigue} />
        <MiniMetric label={t('metrics.attention')} score={scores.attention} accent={colors.attention} />
        <MiniMetric label={t('metrics.relaxation')} score={scores.relaxation} accent={colors.relaxation} />
      </View>
    </Card>
  );
}

function MiniMetric({ label, score, accent }: { label: string; score: number; accent: string }) {
  return (
    <View style={styles.mini}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, { color: accent }]}>
        {score}
        <Text style={styles.miniOutOf}> /5</Text>
      </Text>
    </View>
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
  card: { gap: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardMain: { flex: 1 },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { ...typography.heading, color: colors.text },
  alertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.statusBad },
  updated: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  mini: { flex: 1 },
  miniLabel: { ...typography.caption, color: colors.textMuted },
  miniValue: { ...typography.heading, marginTop: 2 },
  miniOutOf: { ...typography.caption, color: colors.textMuted },
});
