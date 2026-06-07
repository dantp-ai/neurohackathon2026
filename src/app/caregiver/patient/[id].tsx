import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Avatar,
  Card,
  MessageThread,
  MetricTile,
  StatusPill,
} from '@/components';
import { LabelsReview } from '@/components/LabelsReview';
import { LiveWaveform } from '@/components/LiveWaveform';
import { SegmentLabeler } from '@/components/SegmentLabeler';
import { SkiaGraph } from '@/components/SkiaGraph';
import type { GraphPoint } from '@/components/SkiaGraph';
import { StreamControls } from '@/components/StreamControls';
import { useSegmentLabels } from '@/hooks/useSegmentLabels';
import { supabase } from '@/lib/supabase';
import { domainOf, segmentsToPoints } from '@/lib/points';
import {
  CURRENT_CAREGIVER,
  checkinForEvent,
  eventsForPatient,
  heartRateFor,
  labelForEvent,
  patientById,
  scoresFor,
} from '@/mock/data';
import { useEegSegments } from '@/hooks/useEegSegments';
import { CheckinResponseValue, Severity, WellnessMetrics } from '@/types';
import { colors, radius, spacing, StatusLevel, statusColors, typography } from '@/theme';
import { timeAgo } from '@/utils/time';

type Tab = 'metrics' | 'map' | 'alerts' | 'labels' | 'messages';
const TABS: { key: Tab; labelKey: string }[] = [
  { key: 'metrics', labelKey: 'tabs.metrics' },
  { key: 'map', labelKey: 'tabs.map' },
  { key: 'alerts', labelKey: 'tabs.alerts' },
  { key: 'labels', labelKey: 'tabs.labels' },
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
          {tab === 'labels' && <LabelsReview displayName={patient.user.display_name} />}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// --- Metrics tab -----------------------------------------------------------

function MetricsTab({ patientId, metrics }: { patientId: string; metrics: WellnessMetrics }) {
  const { t } = useTranslation();
  const scores = scoresFor(metrics);
  const hr = heartRateFor(patientId);

  const [eeg, setEeg] = useState(true);
  const [vitals, setVitals] = useState(true);

  const eegLines = [
    { color: colors.fatigue, base: 2.8, amp: 1.1, cycles: 3, phase: 0 },
    { color: colors.attention, base: 3.0, amp: 1.0, cycles: 4, phase: 1.2 },
    { color: colors.relaxation, base: 2.7, amp: 0.9, cycles: 2, phase: 2.4 },
  ];
  const hrLines = [{ color: colors.heart, base: hr.value, amp: 9, cycles: 5, phase: 0 }];

  return (
    <View style={{ gap: spacing.lg }}>
      <StreamControls
        eeg={eeg}
        vitals={vitals}
        onToggleEeg={() => setEeg((v) => !v)}
        onToggleVitals={() => setVitals((v) => !v)}
      />
      <View style={styles.metricsRow}>
        <MetricTile label={t('metrics.energy')} score={scores.fatigue} accent={colors.fatigue} />
        <MetricTile label={t('metrics.attention')} score={scores.attention} accent={colors.attention} />
        <MetricTile label={t('metrics.relaxation')} score={scores.relaxation} accent={colors.relaxation} />
      </View>

      <Text style={styles.sectionTitle}>{t('metrics.lastHour')}</Text>
      <LiveWaveform lines={eegLines} active={eeg} min={0.5} max={5} height={150} />
      <View style={styles.legendRow}>
        <LegendDot color={colors.fatigue} label={t('metrics.energy')} />
        <LegendDot color={colors.attention} label={t('metrics.attention')} />
        <LegendDot color={colors.relaxation} label={t('metrics.relaxation')} />
      </View>

      <Text style={styles.sectionTitle}>{t('metrics.vitals')}</Text>
      <Card style={{ gap: spacing.md }}>
        <View style={styles.vitalHead}>
          <Text style={styles.vitalName}>{`❤️  ${t('metrics.heartRate')}`}</Text>
          <View style={styles.vitalRight}>
            <Text style={[styles.vitalValue, { color: statusColors[hr.status].fg }]}>
              {hr.value}
              <Text style={styles.vitalUnit}>{` ${t('common.bpm')}`}</Text>
            </Text>
            <StatusPill level={hr.status} label={t(hr.labelKey)} />
          </View>
        </View>
        <LiveWaveform lines={hrLines} active={vitals} min={hr.value - 18} max={hr.value + 18} height={120} />
      </Card>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

// --- Map tab ---------------------------------------------------------------

function MapTab({ displayName }: { displayName: string }) {
  const { t } = useTranslation();
  const { segments, loading, error } = useEegSegments(displayName);
  const { add } = useSegmentLabels(displayName);
  const base = useMemo(() => segmentsToPoints(segments), [segments]);
  const domain = useMemo(() => domainOf(base), [base]);

  const [live, setLive] = useState<(GraphPoint & { tISO: string })[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newestId, setNewestId] = useState<string | null>(null);
  const manualRef = useRef(false);
  const pidRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('users')
      .select('id')
      .eq('display_name', displayName)
      .maybeSingle()
      .then(({ data }) => {
        if (active) pidRef.current = (data as { id?: string } | null)?.id ?? null;
      });
    return () => {
      active = false;
    };
  }, [displayName]);

  // Stream a new simulated point in near the cloud every few seconds.
  useEffect(() => {
    if (base.length === 0) return;
    const iv = setInterval(() => {
      const seed = base[Math.floor(Math.random() * base.length)];
      const np = {
        id: `live-${Date.now()}`,
        x: seed.x + (Math.random() - 0.5) * 0.7,
        y: seed.y + (Math.random() - 0.5) * 0.7,
        health: Math.max(0, Math.min(1, seed.health + (Math.random() - 0.5) * 0.25)),
        tISO: new Date().toISOString(),
      };
      setLive((l) => [...l.slice(-11), np]);
      setNewestId(np.id);
      if (!manualRef.current) setSelectedId(np.id);
    }, 4000);
    return () => clearInterval(iv);
  }, [base.length]);

  const points = useMemo(() => [...base, ...live], [base, live]);

  const target = useMemo(() => {
    if (!selectedId) return null;
    const lp = live.find((p) => p.id === selectedId);
    if (lp) return { live: true as const, id: lp.id, tISO: lp.tISO, anomaly: lp.health, x: lp.x, y: lp.y };
    const seg = segments.find((s) => s.id === selectedId);
    if (seg) return { live: false as const, id: seg.id, tISO: seg.timestamp_start, anomaly: seg.anomaly_score };
    return null;
  }, [selectedId, live, segments]);

  const onSelect = useCallback((id: string) => {
    manualRef.current = true;
    setSelectedId(id);
  }, []);

  const onLabel = useCallback(
    async (category: string) => {
      if (!target) return;
      manualRef.current = false; // resume auto-follow after labeling
      if (!target.live) {
        add(category, target.id, 'predefined', 'clinician');
        return;
      }
      // Persist the live point as a real segment, then label it.
      let segId: string | null = null;
      if (pidRef.current) {
        const { data } = await supabase
          .from('eeg_segments')
          .insert({
            patient_id: pidRef.current,
            device_id: 'neurodsp-live',
            timestamp_start: target.tISO,
            duration_s: 30,
            fatigue: 0.5,
            attention: 0.5,
            mood: 0.5,
            anomaly_score: Number(target.anomaly ?? 0),
            umap_x: target.x,
            umap_y: target.y,
          })
          .select('id')
          .single();
        segId = (data as { id?: string } | null)?.id ?? null;
      }
      add(category, segId, 'predefined', 'clinician');
      setLive((l) => l.filter((p) => p.id !== target.id)); // realtime adds the persisted one
    },
    [target, add],
  );

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
              height={340}
              selectedId={selectedId}
              onSelectPoint={onSelect}
              interactive
              pulseId={newestId}
              pointOpacity={0.85}
            />
            <View style={styles.mapLegend}>
              <Text style={styles.legendText}>{t('embedding.healthy')}</Text>
              <View style={styles.gradientBar} />
              <Text style={styles.legendText}>{t('embedding.unhealthy')}</Text>
            </View>
          </>
        )}
      </Card>
      <SegmentLabeler
        displayName={displayName}
        targetTime={target?.tISO ?? null}
        targetAnomaly={target?.anomaly ?? null}
        onLabel={onLabel}
      />
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
  legendRow: { flexDirection: 'row', gap: spacing.lg, marginTop: -spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { ...typography.caption, color: colors.textMuted },
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
