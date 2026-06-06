import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Card } from '@/components';
import { SkiaGraph } from '@/components/SkiaGraph';
import { useStreamedTrajectory } from '@/hooks/useStreamedTrajectory';
import { colors, radius, spacing, statusColors, typography } from '@/theme';

const SPEEDS = [1, 4, 16];

function stageFor(health: number): { label: string; color: string } {
  if (health < 0.25) return { label: 'Healthy', color: statusColors.good.fg };
  if (health < 0.5) return { label: 'Early change', color: statusColors.warn.fg };
  if (health < 0.75) return { label: 'Cognitive decline', color: statusColors.warn.fg };
  return { label: 'Dementia-like', color: statusColors.bad.fg };
}

/**
 * Demo version: streams a patient's EEG embedding trajectory in over accelerating
 * time, healthy → unhealthy, as a showcase of the foundation model + monitoring.
 */
export default function DemoScreen() {
  const router = useRouter();
  const { shown, domain, total, count, playing, speed, setSpeed, play, pause, reset, loading } =
    useStreamedTrajectory('Trajectory Demo');

  // Auto-start streaming once the trajectory has loaded (showcase behavior).
  const started = useRef(false);
  useEffect(() => {
    if (!started.current && total > 0) {
      started.current = true;
      play();
    }
  }, [total, play]);

  const current = shown.length ? shown[shown.length - 1].health : 0;
  const stage = stageFor(current);
  const progress = total ? count / total : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Cognitive decline over time</Text>
        <Text style={styles.subtitle}>
          Each point is a 30-second EEG window, embedded live by the foundation model.
          Watch the brain state drift from healthy to dementia as time accelerates.
        </Text>
      </View>

      <Card style={styles.graphCard}>
        <View style={styles.stageRow}>
          <View style={[styles.stageDot, { backgroundColor: stage.color }]} />
          <Text style={[styles.stageLabel, { color: stage.color }]}>{stage.label}</Text>
          <Text style={styles.countLabel}>
            {count} / {total} windows
          </Text>
        </View>

        <SkiaGraph points={shown} domain={domain} showEdges height={360} />

        {/* progress */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>

        {/* color legend */}
        <View style={styles.legend}>
          <Text style={styles.legendText}>Healthy</Text>
          <View style={styles.gradientBar} />
          <Text style={styles.legendText}>Unhealthy</Text>
        </View>
      </Card>

      {/* controls */}
      <View style={styles.controls}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Button
              title={playing ? '❙❙  Pause' : count >= total && total > 0 ? '↺  Replay' : '▶  Play'}
              onPress={playing ? pause : play}
            />
          </View>
          <View style={styles.flex}>
            <Button title="Reset" variant="secondary" onPress={reset} />
          </View>
        </View>
        <View style={styles.speedRow}>
          <Text style={styles.speedLabel}>Speed</Text>
          {SPEEDS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setSpeed(s)}
              style={[styles.speedChip, speed === s && styles.speedChipActive]}
            >
              <Text style={[styles.speedChipText, speed === s && styles.speedChipTextActive]}>
                {s}×
              </Text>
            </Pressable>
          ))}
        </View>
        {loading ? <Text style={styles.hint}>Loading trajectory…</Text> : null}
        {!loading && total === 0 ? (
          <Text style={styles.hint}>
            No trajectory data. Run `uv run python scripts/seed_trajectory.py`.
          </Text>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, gap: spacing.xs },
  back: { ...typography.label, color: colors.primary, marginBottom: spacing.sm },
  title: { ...typography.title, color: colors.text },
  subtitle: { ...typography.body, color: colors.textMuted },
  graphCard: { marginHorizontal: spacing.lg, gap: spacing.md },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stageDot: { width: 14, height: 14, borderRadius: 7 },
  stageLabel: { ...typography.heading, flex: 1 },
  countLabel: { ...typography.label, color: colors.textMuted },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  legend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendText: { ...typography.caption, color: colors.textMuted },
  gradientBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    // simple 3-stop feel via border + bg (RN has no inline gradient w/o a lib)
    backgroundColor: colors.statusWarn,
    borderLeftWidth: 24,
    borderLeftColor: colors.statusGood,
    borderRightWidth: 24,
    borderRightColor: colors.statusBad,
  },
  controls: { padding: spacing.lg, gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  flex: { flex: 1 },
  speedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  speedLabel: { ...typography.label, color: colors.textMuted, marginRight: spacing.sm },
  speedChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  speedChipActive: { backgroundColor: colors.primary },
  speedChipText: { ...typography.label, color: colors.textMuted },
  speedChipTextActive: { color: colors.textInverse },
  hint: { ...typography.caption, color: colors.textMuted },
});
