import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Avatar,
  EmbeddingMap,
  LabelReviewCard,
  MessageThread,
  MetricTile,
  StatusPill,
} from '@/components';
import {
  CURRENT_CAREGIVER,
  checkinForEvent,
  eventsForPatient,
  labelForEvent,
  labelsForPatient,
  patientById,
  timelineFor,
} from '@/mock/data';
import { useEegSegments } from '@/hooks/useEegSegments';
import { CheckinResponseValue, Severity } from '@/types';
import { colors, radius, spacing, StatusLevel, statusColors, typography } from '@/theme';
import { timeAgo } from '@/utils/time';

type Tab = 'metrics' | 'map' | 'alerts' | 'messages' | 'labels';
const TABS: { key: Tab; label: string }[] = [
  { key: 'metrics', label: 'Metrics' },
  { key: 'map', label: 'Map' },
  { key: 'alerts', label: 'Alerts' },
  { key: 'messages', label: 'Messages' },
  { key: 'labels', label: 'Labels' },
];

const SEVERITY_LEVEL: Record<Severity, StatusLevel> = {
  low: 'good',
  medium: 'warn',
  high: 'bad',
};

const CHECKIN_TEXT: Record<CheckinResponseValue, string> = {
  ok: "Patient: I'm okay",
  not_great: 'Patient: Not great',
  help: 'Patient: I need help',
};

export default function PatientDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('metrics');

  const patient = id ? patientById(id) : undefined;

  if (!patient) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>Patient not found.</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.back}>‹ Patients</Text>
        </Pressable>
        <View style={styles.headerMain}>
          <Avatar name={patient.user.display_name} uri={patient.user.avatar_url} size={44} />
          <Text style={styles.name}>{patient.user.display_name}</Text>
          <StatusPill level={patient.status} label={patient.status.toUpperCase()} />
        </View>
      </View>

      {/* Segmented tabs */}
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {tab === 'messages' ? (
        <MessageThread
          patientId={patient.user.id}
          caregiverId={CURRENT_CAREGIVER.id}
          currentUserId={CURRENT_CAREGIVER.id}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {tab === 'metrics' && <MetricsTab patientId={patient.user.id} metrics={patient.metrics} />}
          {tab === 'map' && <MapTab displayName={patient.user.display_name} />}
          {tab === 'alerts' && <AlertsTab patientId={patient.user.id} />}
          {tab === 'labels' && <LabelsTab patientId={patient.user.id} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// --- Metrics tab -----------------------------------------------------------

function MetricsTab({ patientId, metrics }: { patientId: string; metrics: { fatigue: number; attention: number; mood: number } }) {
  const series = timelineFor(patientId);
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.metricsRow}>
        <MetricTile label="Fatigue" value={metrics.fatigue} accent={colors.fatigue} />
        <MetricTile label="Attention" value={metrics.attention} accent={colors.attention} />
        <MetricTile label="Mood" value={metrics.mood} accent={colors.mood} />
      </View>
      <Text style={styles.sectionTitle}>Last 12 hours</Text>
      <Sparkbars label="Fatigue" values={series.map((p) => p.fatigue)} accent={colors.fatigue} />
      <Sparkbars label="Attention" values={series.map((p) => p.attention)} accent={colors.attention} />
      <Sparkbars label="Mood" values={series.map((p) => p.mood)} accent={colors.mood} />
    </View>
  );
}

/** Dependency-free mini bar chart: one bar per time point. */
function Sparkbars({ label, values, accent }: { label: string; values: number[]; accent: string }) {
  return (
    <View style={styles.spark}>
      <Text style={styles.sparkLabel}>{label}</Text>
      <View style={styles.sparkBars}>
        {values.map((v, i) => (
          <View key={i} style={styles.sparkCol}>
            <View style={[styles.sparkFill, { height: `${Math.max(4, v)}%`, backgroundColor: accent }]} />
          </View>
        ))}
      </View>
    </View>
  );
}

// --- Map tab ---------------------------------------------------------------

function MapTab({ displayName }: { displayName: string }) {
  const { segments, loading, error } = useEegSegments(displayName);
  if (loading) {
    return <Text style={styles.empty}>Loading embedding map…</Text>;
  }
  if (error) {
    return <Text style={styles.empty}>Could not load EEG segments: {error}</Text>;
  }
  return <EmbeddingMap segments={segments} />;
}

// --- Alerts tab ------------------------------------------------------------

function AlertsTab({ patientId }: { patientId: string }) {
  const events = eventsForPatient(patientId);
  if (events.length === 0) {
    return <Text style={styles.empty}>No alerts for this patient.</Text>;
  }
  return (
    <View style={{ gap: spacing.md }}>
      {events.map((e) => {
        const level = SEVERITY_LEVEL[e.severity];
        const checkin = checkinForEvent(e.id);
        const label = labelForEvent(e.id);
        const tint = statusColors[level];
        return (
          <View key={e.id} style={[styles.alertCard, { borderLeftColor: tint.fg }]}>
            <View style={styles.alertHead}>
              <Text style={styles.alertTime}>{timeAgo(e.triggered_at)}</Text>
              <StatusPill level={level} label={e.severity.toUpperCase()} />
            </View>
            <Text style={styles.alertCheckin}>
              {checkin ? CHECKIN_TEXT[checkin.response] : 'No response'}
            </Text>
            {label ? <Text style={styles.alertSummary}>“{label.subjective_state}”</Text> : null}
            <StatusPill
              level={e.resolved ? 'good' : 'warn'}
              label={e.resolved ? 'Resolved' : 'Needs Follow-Up'}
            />
          </View>
        );
      })}
    </View>
  );
}

// --- Labels tab ------------------------------------------------------------

function LabelsTab({ patientId }: { patientId: string }) {
  const labels = labelsForPatient(patientId);
  if (labels.length === 0) {
    return <Text style={styles.empty}>No labels extracted yet.</Text>;
  }
  return (
    <View style={{ gap: spacing.lg }}>
      {labels.map((l) => (
        <LabelReviewCard key={l.id} label={l} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  missing: { ...typography.body, color: colors.textMuted, padding: spacing.lg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  backBtn: { marginBottom: spacing.sm },
  back: { ...typography.label, color: colors.primary },
  headerMain: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { ...typography.title, color: colors.text, flex: 1 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.surface },
  tabLabel: { ...typography.label, color: colors.textMuted },
  tabLabelActive: { color: colors.text },
  content: { padding: spacing.lg },
  metricsRow: { flexDirection: 'row', gap: spacing.md },
  sectionTitle: { ...typography.heading, color: colors.text },
  empty: { ...typography.body, color: colors.textMuted },
  spark: { gap: spacing.sm },
  sparkLabel: { ...typography.label, color: colors.textMuted },
  sparkBars: { flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 4 },
  sparkCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  sparkFill: { width: '100%', borderRadius: 3, minHeight: 3 },
  alertCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderLeftWidth: 4,
    gap: spacing.sm,
  },
  alertHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertTime: { ...typography.bodyStrong, color: colors.text },
  alertCheckin: { ...typography.body, color: colors.text },
  alertSummary: { ...typography.body, color: colors.textMuted, fontStyle: 'italic' },
});
