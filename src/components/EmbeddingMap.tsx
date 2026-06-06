import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { Card } from './Card';
import { colors, spacing, statusColors, typography } from '@/theme';
import { EegSegment } from '@/types';

type Props = {
  segments: EegSegment[];
  /** Highlighted segment id (rendered with a ring). Optional. */
  selectedId?: string;
};

type Plottable = {
  segment: EegSegment;
  x: number;
  y: number;
};

const PADDING = 24;
const POINT_RADIUS = 6;
const SELECTED_RADIUS = 10;
const MIN_HEIGHT = 280;

/**
 * 2D scatter plot of UMAP-projected EEG embeddings.
 * Each dot is one 30s segment, colored by anomaly_score
 * (green = baseline → red = anomalous).
 */
export function EmbeddingMap({ segments, selectedId }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const plottable = useMemo<Plottable[]>(
    () =>
      segments
        .filter((s): s is EegSegment & { umap_x: number; umap_y: number } =>
          Number.isFinite(s.umap_x) && Number.isFinite(s.umap_y),
        )
        .map((segment) => ({ segment, x: segment.umap_x as number, y: segment.umap_y as number })),
    [segments],
  );

  if (plottable.length === 0) {
    return (
      <Card>
        <Text style={styles.title}>Embedding map</Text>
        <Text style={styles.empty}>No embedding data yet.</Text>
      </Card>
    );
  }

  const xs = plottable.map((p) => p.x);
  const ys = plottable.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  // Pad the bounding box so points aren't flush against the edge.
  const xRange = Math.max(xMax - xMin, 1e-6);
  const yRange = Math.max(yMax - yMin, 1e-6);
  const xPad = xRange * 0.08;
  const yPad = yRange * 0.08;
  const xLo = xMin - xPad;
  const xHi = xMax + xPad;
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;

  const height = Math.max(MIN_HEIGHT, width); // square-ish plot
  const innerW = Math.max(width - PADDING * 2, 1);
  const innerH = Math.max(height - PADDING * 2, 1);

  const project = (px: number, py: number) => {
    const nx = (px - xLo) / (xHi - xLo);
    // Flip Y so larger values are visually higher.
    const ny = 1 - (py - yLo) / (yHi - yLo);
    return { sx: PADDING + nx * innerW, sy: PADDING + ny * innerH };
  };

  // Sort so anomalous (red) dots draw on top of baseline (green).
  const sorted = [...plottable].sort(
    (a, b) => a.segment.anomaly_score - b.segment.anomaly_score,
  );

  return (
    <Card>
      <Text style={styles.title}>Embedding map</Text>
      <Text style={styles.subtitle}>
        {plottable.length} segments · color = anomaly score
      </Text>
      <View onLayout={onLayout} style={styles.plot}>
        {width > 0 && (
          <Svg width={width} height={height}>
            <Rect
              x={PADDING / 2}
              y={PADDING / 2}
              width={width - PADDING}
              height={height - PADDING}
              fill={colors.surfaceAlt}
              rx={12}
            />
            {/* Faint center crosshairs */}
            <Line
              x1={PADDING}
              y1={height / 2}
              x2={width - PADDING}
              y2={height / 2}
              stroke={colors.border}
              strokeWidth={1}
            />
            <Line
              x1={width / 2}
              y1={PADDING}
              x2={width / 2}
              y2={height - PADDING}
              stroke={colors.border}
              strokeWidth={1}
            />
            {sorted.map(({ segment, x, y }) => {
              const { sx, sy } = project(x, y);
              const isSelected = segment.id === selectedId;
              const fill = colorForScore(segment.anomaly_score);
              return (
                <Circle
                  key={segment.id}
                  cx={sx}
                  cy={sy}
                  r={isSelected ? SELECTED_RADIUS : POINT_RADIUS}
                  fill={fill}
                  stroke={isSelected ? colors.text : colors.surface}
                  strokeWidth={isSelected ? 2 : 1}
                />
              );
            })}
          </Svg>
        )}
      </View>
      <View style={styles.legend}>
        <LegendDot color={statusColors.good.fg} label="Baseline" />
        <LegendDot color={statusColors.warn.fg} label="Mid" />
        <LegendDot color={statusColors.bad.fg} label="Anomalous" />
      </View>
    </Card>
  );
}

/** Map anomaly_score [0,1] → traffic-light color. */
function colorForScore(score: number): string {
  if (score >= 0.66) return statusColors.bad.fg;
  if (score >= 0.33) return statusColors.warn.fg;
  return statusColors.good.fg;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  empty: { ...typography.body, color: colors.textMuted, marginTop: spacing.md },
  plot: { marginTop: spacing.md, width: '100%' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    marginTop: spacing.md,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendSwatch: { width: 12, height: 12, borderRadius: 6 },
  legendLabel: { ...typography.caption, color: colors.textMuted },
});

export default EmbeddingMap;
