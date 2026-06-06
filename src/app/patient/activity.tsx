import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, Screen } from '@/components';
import { activityLogsForPatient, CURRENT_PATIENT_ID } from '@/mock/data';
import { ActivityLog, ActivityType } from '@/types';
import { colors, radius, spacing, typography } from '@/theme';
import { timeAgo } from '@/utils/time';

const OPTIONS: { type: ActivityType; emoji: string; label: string }[] = [
  { type: 'sleeping', emoji: '😴', label: 'Sleeping' },
  { type: 'eating', emoji: '🍽️', label: 'Eating' },
  { type: 'walking', emoji: '🚶', label: 'Walking' },
  { type: 'resting', emoji: '🛋️', label: 'Resting' },
  { type: 'social', emoji: '👥', label: 'Socializing' },
  { type: 'other', emoji: '➕', label: 'Other' },
];

const LABELS: Record<ActivityType, string> = {
  sleeping: 'Sleeping',
  eating: 'Eating',
  walking: 'Walking',
  resting: 'Resting',
  social: 'Socializing',
  other: 'Other',
};

/** Quick-log the current activity; shows a running list of recent logs. */
export default function ActivityScreen() {
  const [logs, setLogs] = useState<ActivityLog[]>(() =>
    activityLogsForPatient(CURRENT_PATIENT_ID),
  );

  const add = (type: ActivityType) => {
    // TODO(backend): insert into activity_logs.
    setLogs((prev) => [
      {
        id: `local-${Date.now()}`,
        patient_id: CURRENT_PATIENT_ID,
        activity: type,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  return (
    <Screen>
      <Text style={styles.title}>Activity</Text>
      <Text style={styles.subtitle}>What are you doing right now?</Text>

      <View style={styles.grid}>
        {OPTIONS.map((o) => (
          <Pressable key={o.type} style={styles.tile} onPress={() => add(o.type)}>
            <Text style={styles.tileEmoji}>{o.emoji}</Text>
            <Text style={styles.tileLabel}>{o.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Recent</Text>
      <Card style={styles.list}>
        {logs.map((log, i) => (
          <View key={log.id} style={[styles.row, i < logs.length - 1 && styles.rowBorder]}>
            <Text style={styles.rowLabel}>{LABELS[log.activity]}</Text>
            <Text style={styles.rowTime}>{timeAgo(log.created_at)}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  tileEmoji: { fontSize: 34 },
  tileLabel: { ...typography.bodyStrong, color: colors.text },
  sectionTitle: { ...typography.heading, color: colors.text, marginTop: spacing.xl, marginBottom: spacing.md },
  list: { paddingVertical: spacing.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowLabel: { ...typography.body, color: colors.text },
  rowTime: { ...typography.caption, color: colors.textMuted },
});
