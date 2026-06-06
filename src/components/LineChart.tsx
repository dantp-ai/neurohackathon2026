import { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';

import { colors, spacing, typography } from '@/theme';

export type LineSeries = {
  label: string;
  color: string;
  /** Y values, oldest → newest. */
  values: number[];
};

type LineChartProps = {
  series: LineSeries[];
  min?: number;
  max?: number;
  height?: number;
};

/**
 * Lightweight multi-series line chart (react-native-svg). Built for the 1–5
 * metric scale that updates in real time. Y axis labeled at each integer.
 */
export function LineChart({ series, min = 1, max = 5, height = 160 }: LineChartProps) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const padL = 22;
  const padR = 8;
  const padV = 10;
  const plotW = Math.max(0, width - padL - padR);
  const plotH = height - padV * 2;

  const x = (i: number, n: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number) => padV + (1 - (v - min) / (max - min)) * plotH;

  // ~5 evenly spaced, rounded tick values (works for both the 1–5 scale and bpm).
  const NUM_TICKS = 5;
  const ticks = Array.from(
    new Set(
      Array.from({ length: NUM_TICKS }, (_, i) =>
        Math.round(min + (i / (NUM_TICKS - 1)) * (max - min)),
      ),
    ),
  );

  return (
    <View>
      <View onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <Line
                key={t}
                x1={padL}
                y1={y(t)}
                x2={width - padR}
                y2={y(t)}
                stroke={colors.border}
                strokeWidth={1}
              />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={4} y={y(t) + 4} fontSize={10} fill={colors.textMuted}>
                {t}
              </SvgText>
            ))}
            {series.map((s) => (
              <Polyline
                key={s.label}
                points={s.values.map((v, i) => `${x(i, s.values.length)},${y(v)}`).join(' ')}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>
      <View style={styles.legend}>
        {series.map((s) => (
          <View key={s.label} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { ...typography.caption, color: colors.textMuted },
});

export default LineChart;
