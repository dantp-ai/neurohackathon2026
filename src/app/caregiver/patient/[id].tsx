import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Avatar,
  Button,
  Card,
  EmbeddingMap,
  LabelReviewCard,
  LineChart,
  MessageThread,
  MetricTile,
  StatusPill,
} from '@/components';
import {
  CURRENT_CAREGIVER,
  checkinForEvent,
  eventsForPatient,
  heartRateFor,
  labelForEvent,
  labelsForPatient,
  patientById,
  scoresFor,
  timelineFor,
} from '@/mock/data';
import { useEegSegments } from '@/hooks/useEegSegments';
import { CheckinResponseValue, Label, Severity, WellnessMetrics } from '@/types';
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

function MetricsTab({ patientId, metrics }: { patientId: string; metrics: WellnessMetrics }) {
  const series = timelineFor(patientId);
  const scores = scoresFor(metrics);
  const hr = heartRateFor(patientId);
  const hrMin = Math.min(...hr.trend) - 5;
  const hrMax = Math.max(...hr.trend) + 5;
  return (
    <View style={{ gap: spacing.lg }}>
      <View style={styles.metricsRow}>
        <MetricTile label="Energy" score={scores.fatigue} accent={colors.fatigue} />
        <MetricTile label="Attention" score={scores.attention} accent={colors.attention} />
        <MetricTile label="Relaxation" score={scores.relaxation} accent={colors.relaxation} />
      </View>

      <Text style={styles.sectionTitle}>Last hour</Text>
      <LineChart
        series={[
          { label: 'Energy', color: colors.fatigue, values: series.map((p) => p.fatigue) },
          { label: 'Attention', color: colors.attention, values: series.map((p) => p.attention) },
          { label: 'Relaxation', color: colors.relaxation, values: series.map((p) => p.relaxation) },
        ]}
      />

      <Text style={styles.sectionTitle}>Vitals</Text>
      <Card style={{ gap: spacing.md }}>
        <View style={styles.vitalHead}>
          <Text style={styles.vitalName}>❤️  Heart Rate</Text>
          <View style={styles.vitalRight}>
            <Text style={[styles.vitalValue, { color: statusColors[hr.status].fg }]}>
              {hr.value}
              <Text style={styles.vitalUnit}> bpm</Text>
            </Text>
            <StatusPill level={hr.status} label={hr.label} />
          </View>
        </View>
        <LineChart
          series={[{ label: 'Heart rate (bpm)', color: colors.heart, values: hr.trend }]}
          min={hrMin}
          max={hrMax}
          height={120}
        />
      </Card>
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
  const [showResolved, setShowResolved] = useState(false);
  const all = eventsForPatient(patientId);
  const events = showResolved ? all : all.filter((e) => !e.resolved);
  const resolvedCount = all.filter((e) => e.resolved).length;

  return (
    <View style={{ gap: spacing.md }}>
      {resolvedCount > 0 ? (
        <Pressable style={styles.toggleRow} onPress={() => setShowResolved((s) => !s)}>
          <Text style={styles.toggleLabel}>
            {showResolved ? 'Hide' : 'Show'} resolved ({resolvedCount})
          </Text>
        </Pressable>
      ) : null}
      {events.length === 0 ? (
        <Text style={styles.empty}>No active alerts for this patient.</Text>
      ) : null}
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

function blankLabel(patientId: string): Label {
  return {
    id: `local-${Date.now()}`,
    patient_id: patientId,
    segment_id: '',
    event_id: '',
    activity: '',
    medications: [],
    subjective_state: '',
    event_type: '',
    resolution: '',
    extraction_method: 'caregiver_manual',
    confidence: 1,
    confirmed_by_caregiver: false,
  };
}

function LabelsTab({ patientId }: { patientId: string }) {
  const [added, setAdded] = useState<Label[]>([]);
  const labels = [...added, ...labelsForPatient(patientId)];

  return (
    <View style={{ gap: spacing.lg }}>
      <Button
        title="+ Add label"
        variant="secondary"
        onPress={() => setAdded((p) => [blankLabel(patientId), ...p])}
      />
      {labels.length === 0 ? (
        <Text style={styles.empty}>No labels yet.</Text>
      ) : (
        labels.map((l) => (
          <LabelReviewCard key={l.id} label={l} initialEditing={l.extraction_method === 'caregiver_manual' && !l.confirmed_by_caregiver} />
        ))
      )}
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
  cardTitle: { ...typography.bodyStrong, color: colors.text },
  empty: { ...typography.body, color: colors.textMuted },
  toggleRow: { alignSelf: 'flex-start' },
  toggleLabel: { ...typography.label, color: colors.primary },
  vitalHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vitalName: { ...typography.bodyStrong, color: colors.text },
  vitalRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  vitalValue: { ...typography.heading },
  vitalUnit: { ...typography.label, color: colors.textMuted },
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
