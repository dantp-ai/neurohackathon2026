/**
 * PatientBrainMap — the patient's own (frozen) embedding cloud, with a new point
 * gently "added" near the cloud every few seconds (with a pulse aura on the
 * newest one), so the patient sees their monitoring feels alive. Non-interactive.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text } from 'react-native';

import { Card } from './Card';
import { SkiaGraph } from './SkiaGraph';
import type { GraphPoint } from './EmbeddingGraph';
import { useEegSegments } from '@/hooks/useEegSegments';
import { domainOf, segmentsToPoints } from '@/lib/points';
import { colors, spacing, typography } from '@/theme';

export function PatientBrainMap({ displayName }: { displayName: string }) {
  const { t } = useTranslation();
  const { segments } = useEegSegments(displayName);

  // Frozen base cloud (subsampled for a light home screen) + fixed domain.
  const base = useMemo(() => {
    const all = segmentsToPoints(segments);
    if (all.length <= 140) return all;
    const stride = Math.ceil(all.length / 140);
    return all.filter((_, i) => i % stride === 0);
  }, [segments]);
  const domain = useMemo(() => domainOf(base), [base]);

  const [extra, setExtra] = useState<GraphPoint[]>([]);
  const [pulseId, setPulseId] = useState<string | null>(null);

  useEffect(() => {
    if (base.length === 0) return;
    const id = setInterval(() => {
      const seed = base[Math.floor(Math.random() * base.length)];
      const np: GraphPoint = {
        id: `live-${Date.now()}`,
        x: seed.x + (Math.random() - 0.5) * 0.6,
        y: seed.y + (Math.random() - 0.5) * 0.6,
        health: Math.max(0, Math.min(1, seed.health + (Math.random() - 0.5) * 0.2)),
      };
      setExtra((e) => [...e.slice(-30), np]);
      setPulseId(np.id);
    }, 3000);
    return () => clearInterval(id);
  }, [base.length]);

  const points = useMemo(() => [...base, ...extra], [base, extra]);
  if (base.length === 0) return null;

  return (
    <Card style={{ gap: spacing.sm }}>
      <Text style={styles.title}>{t('patient.brainMap')}</Text>
      <Text style={styles.sub}>{t('patient.brainMapSub')}</Text>
      <SkiaGraph points={points} domain={domain} height={240} grid pulseId={pulseId} />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.text },
  sub: { ...typography.caption, color: colors.textMuted },
});

export default PatientBrainMap;
