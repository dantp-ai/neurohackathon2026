/**
 * AuraRing — a WHOOP-style wellness ring for the patient home. A sweep-gradient
 * arc fills to the patient's overall wellness score, wrapped in a soft breathing
 * "aura" glow and a pulsing end dot. Color reflects status (green/amber/red).
 * Driven by the patient's biomarkers. Pure Skia + reanimated, runs at 60fps.
 */
import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlurMask, Canvas, Circle, Group, Path, Skia, SweepGradient, vec } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { colors, typography } from '@/theme';

const SIZE = 220;
const STROKE = 18;
const C = SIZE / 2;
const RAD = C - STROKE - 8;

export type AuraLevel = 'good' | 'warn' | 'bad';
const RING: Record<AuraLevel, string[]> = {
  good: ['#2EA66B', '#8BE0A0', '#39B377', '#2EA66B'],
  warn: ['#E8A317', '#F6D26A', '#EBA92A', '#E8A317'],
  bad: ['#D64545', '#F59171', '#DC5A5A', '#D64545'],
};

export type AuraRingProps = {
  score: number;
  level: AuraLevel;
  label: string;
  sublabel?: string;
};

export function AuraRingView({ score, level, label, sublabel }: AuraRingProps) {
  const s = Math.max(0.04, Math.min(1, score));
  const cols = RING[level];

  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [breath]);
  const glowOpacity = useDerivedValue(() => 0.3 + breath.value * 0.45);
  const ringScale = useDerivedValue(() => [{ scale: 1 + breath.value * 0.02 }]);
  const dotR = useDerivedValue(() => STROKE / 2 + breath.value * 3);

  const arc = useMemo(() => {
    const p = Skia.Path.Make();
    const rect = Skia.XYWHRect(C - RAD, C - RAD, RAD * 2, RAD * 2);
    p.addArc(rect, -90, s * 360);
    return p;
  }, [s]);

  const endAngle = ((-90 + s * 360) * Math.PI) / 180;
  const ex = C + RAD * Math.cos(endAngle);
  const ey = C + RAD * Math.sin(endAngle);

  return (
    <View style={styles.wrap}>
      <Canvas style={{ width: SIZE, height: SIZE }}>
        <Group origin={vec(C, C)} transform={ringScale}>
          <Circle cx={C} cy={C} r={RAD} style="stroke" strokeWidth={STROKE} color="rgba(120,130,140,0.12)" />
          {/* soft aura glow */}
          <Path path={arc} style="stroke" strokeWidth={STROKE + 10} strokeCap="round" color={cols[0]} opacity={glowOpacity}>
            <BlurMask blur={14} style="normal" />
          </Path>
          {/* gradient progress arc */}
          <Path path={arc} style="stroke" strokeWidth={STROKE} strokeCap="round">
            <SweepGradient c={vec(C, C)} colors={cols} />
          </Path>
          {/* pulsing end dot */}
          <Circle cx={ex} cy={ey} r={dotR} color="#FFFFFF" opacity={0.95}>
            <BlurMask blur={3} style="solid" />
          </Circle>
        </Group>
      </Canvas>
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.score}>{Math.round(s * 100)}</Text>
        <Text style={styles.label}>{label}</Text>
        {sublabel ? <Text style={styles.sub}>{sublabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  score: { fontSize: 52, fontWeight: '800', color: colors.text, lineHeight: 56 },
  label: { ...typography.bodyStrong, color: colors.textMuted, marginTop: 2 },
  sub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});

export default AuraRingView;
