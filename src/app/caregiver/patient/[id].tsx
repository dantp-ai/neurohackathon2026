import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Avatar,
  Card,
  LineChart,
  MessageThread,
  MetricTile,
  StatusPill,
} from '@/components';
import { SegmentLabeler } from '@/components/SegmentLabeler';
import { SkiaGraph } from '@/components/SkiaGraph';
import { StreamControls, StreamSource } from '@/components/StreamControls';
import { domainOf, segmentsToPoints } from '@/lib/points';
import {
  CURRENT_CAREGIVER,
  checkinForEvent,
  eventsForPatient,
  heartRateFor,
  labelForEvent,
  patientById,
  scoresFor,
  timelineFor,
} from '@/mock/data';
import { useEegSegments } from '@/hooks/useEegSegments';
import { useLiveWave } from '@/hooks/useLiveWave';
import { CheckinResponseValue, Severity, WellnessMetrics } from '@/types';
import { colors, radius, spacing, StatusLevel, statusColors, typography } from '@/theme';
import { timeAgo } from '@/utils/time';

type Tab = 'metrics' | 'map' | 'alerts' | 'messages';
const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'metrics', labelKey: 'tabs.metrics' },
  { key: 'map', labelKey: 'tabs.map' },
  { key: 'alerts', labelKey: 'tabs.alerts' },
  { key: 'messages', labelKey: 'tabs.messagesShort' },
];

const SEVERITY_LEVEL: Record<Severity, StatusLevel> = {
  low: 'good',
  medium: 'warn',
  high: 'bad',
};

const STATUS_KEY: Record<StatusLevel, string> = {
  good: 'status.stable',
  warn: 'status.watch',
  bad: 'status.urgent',
};

const CHECKIN_KEY: Record<CheckinResponseValue, string> = {
  ok: 'feelings.okay',
  not_great: 'feelings.notGreat',
  help: 'feelings.needHelp',
};

export default function PatientDetail() {
  const router = useRouter();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>('metrics');

  const patient = id ? patientById(id) : undefined;

  if (!patient) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.missing}>{t('caregiver.patientNotFound')}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>{`‹ ${t('common.back')}`}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.back}>{`‹ ${t('common.patients')}`}</Text>
        </Pressable>
        <View style={styles.headerMain}>
          <Avatar name={patient.user.display_name} uri={patient.user.avatar_url} size={44} />
          <Text style={styles.name}>{patient.user.display_name}</Text>
          <StatusPill level={patient.status} label={t(STATUS_KEY[patient.status])} />
        </View>
      </View>

      {/* Segmented tabs */}
      <View style={styles.tabs}>
        {TABS.map((item) => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tab, active && styles.tabActive]}
            >
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t(item.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {tab === 'messages' ? (
        <MessageThread
          patientName={patient.user.display_name}
          caregiverName={CURRENT_CAREGIVER.display_name}
          senderRole="caregiver"
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {tab === 'metrics' && <MetricsTab patientId={patient.user.id} metrics={patient.metrics} />}
          {tab === 'map' && <MapTab displayName={patient.user.display_name} />}
          {tab === 'alerts' && <AlertsTab patientId={patient.user.id} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// --- Metrics tab -----------------------------------------------------------

function MetricsTab({ patientId, metrics }: { patientId: string; metrics: WellnessMetrics }) {
  const { t } = useTranslation();
  const series = timelineFor(patientId);
  const scores = scoresFor(metrics);
  const hr = heartRateFor(patientId);

  const [eeg, setEeg] = useState(true);
  const [vitals, setVitals] = useState(true);
  const [source, setSource] = useState<StreamSource>('simulated');

  // Live scrolling waveforms while "streaming"; frozen historical when stopped.
  const energy = useLiveWave(eeg, { base: 2.6, amp: 1.1, phase: 0 });
  const attention = useLiveWave(eeg, { base: 3.0, amp: 1.0, phase: 2 });
  const relax = useLiveWave(eeg, { base: 2.8, amp: 0.9, phase: 4 });
  const hrWave = useLiveWave(vitals, { base: hr.value, amp: 9, phase: 1, periodMs: 600 });

  const energyVals = eeg ? energy : series.map((p) => p.fatigue);
  const attentionVals = eeg ? attention : series.map((p) => p.attention);
  const relaxVals = eeg ? relax : series.map((p) => p.relaxation);
  const hrVals = vitals ? hrWave : hr.trend;
  const hrMin = vitals ? hr.value - 18 : Math.min(...hr.trend) - 5;
  const hrMax = vitals ? hr.value + 18 : Math.max(...hr.trend) + 5;
  const hrNow = Math.round(hrVals[hrVals.length - 1] ?? hr.value);

  return (
    <View style={{ gap: spacing.lg }}>
      <StreamControls
        eeg={eeg}
        vitals={vitals}
        source={source}
        onToggleEeg={() => setEeg((v) => !v)}
        onToggleVitals={() => setVitals((v) => !v)}
        onSource={setSource}
      />
      <View style={styles.metricsRow}>
        <MetricTile label={t('metrics.energy')} score={scores.fatigue} accent={colors.fatigue} />
        <MetricTile label={t('metrics.attention')} score={scores.attention} accent={colors.attention} />
        <MetricTile label={t('metrics.relaxation')} score={scores.relaxation} accent={colors.relaxation} />
      </View>

      <Text style={styles.sectionTitle}>{t('metrics.lastHour')}</Text>
      <LineChart
        series={[
          { label: t('metrics.energy'), color: colors.fatigue, values: energyVals },
          { label: t('metrics.attention'), color: colors.attention, values: attentionVals },
          { label: t('metrics.relaxation'), color: colors.relaxation, values: relaxVals },
        ]}
      />

      <Text style={styles.sectionTitle}>{t('metrics.vitals')}</Text>
      <Card style={{ gap: spacing.md }}>
        <View style={styles.vitalHead}>
          <Text style={styles.vitalName}>{`❤️  ${t('metrics.heartRate')}`}</Text>
          <View style={styles.vitalRight}>
            <Text style={[styles.vitalValue, { color: statusColors[hr.status].fg }]}>
              {hrNow}
              <Text style={styles.vitalUnit}>{` ${t('common.bpm')}`}</Text>
            </Text>
            <StatusPill level={hr.status} label={t(hr.labelKey)} />
          </View>
        </View>
        <LineChart
          series={[{ label: `${t('metrics.heartRate')} (${t('common.bpm')})`, color: colors.heart, values: hrVals }]}
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
  const { t } = useTranslation();
  const { segments, loading, error } = useEegSegments(displayName);
  const points = useMemo(() => segmentsToPoints(segments), [segments]);
  const domain = useMemo(() => domainOf(points), [points]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) {
    return <Text style={styles.empty}>{t('common.loading')}</Text>;
  }
  if (error) {
    return <Text style={styles.empty}>{t('caregiver.segmentsError', { error })}</Text>;
  }
  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.md }}>
        <Text style={styles.sectionTitle}>{t('embedding.title')}</Text>
        <Text style={styles.empty}>{t('embedding.subtitle', { count: points.length })}</Text>
        {points.length === 0 ? (
          <Text style={styles.empty}>{t('embedding.empty')}</Text>
        ) : (
          <>
            <SkiaGraph
              points={points}
              domain={domain}
              showEdges
              height={340}
              selectedId={selectedId}
              onSelectPoint={setSelectedId}
            />
            <View style={styles.mapLegend}>
              <Text style={styles.legendText}>{t('embedding.healthy')}</Text>
              <View style={styles.gradientBar} />
              <Text style={styles.legendText}>{t('embedding.unhealthy')}</Text>
            </View>
          </>
        )}
      </Card>
      <SegmentLabeler displayName={displayName} segments={segments} selectedId={selectedId} />
    </View>
  );
}

// --- Alerts tab ------------------------------------------------------------

function AlertsTab({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const [showResolved, setShowResolved] = useState(false);
  const all = eventsForPatient(patientId);
  const events = showResolved ? all : all.filter((e) => !e.resolved);
  const resolvedCount = all.filter((e) => e.resolved).length;

  return (
    <View style={{ gap: spacing.md }}>
      {resolvedCount > 0 ? (
        <Pressable style={styles.toggleRow} onPress={() => setShowResolved((s) => !s)}>
          <Text style={styles.toggleLabel}>
            {t(showResolved ? 'alerts.hideResolved' : 'alerts.showResolved', { count: resolvedCount })}
          </Text>
        </Pressable>
      ) : null}
      {events.length === 0 ? (
        <Text style={styles.empty}>{t('alerts.noActive')}</Text>
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
              <StatusPill level={level} label={t(`severity.${e.severity}`)} />
            </View>
            <Text style={styles.alertCheckin}>
              {checkin ? t(CHECKIN_KEY[checkin.response]) : t('alerts.noResponse')}
            </Text>
            {label ? <Text style={styles.alertSummary}>“{label.subjective_state}”</Text> : null}
            <StatusPill
              level={e.resolved ? 'good' : 'warn'}
              label={t(e.resolved ? 'alerts.resolved' : 'alerts.needsFollowUp')}
            />
          </View>
        );
      })}
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
  mapLegend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendText: { ...typography.caption, color: colors.textMuted },
  gradientBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.statusWarn,
    borderLeftWidth: 24,
    borderLeftColor: colors.statusGood,
    borderRightWidth: 24,
    borderRightColor: colors.statusBad,
  },
});
