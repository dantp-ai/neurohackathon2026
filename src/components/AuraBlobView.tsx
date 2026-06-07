/**
 * AuraBlobView — an abstract, slowly-evolving "aura" orb for the patient home.
 *
 * A dense cloud of individual neon points (concentric golden-angle rings), each
 * a shade of the overall wellbeing state, glowing additively over a soft dark
 * radial core so it reads as a slick, cyberpunk-y orb. The whole thing rotates
 * slowly, breathes, and each point wobbles on its own phase — a living blob.
 * No numbers, no labels. Animated entirely on the UI thread.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { BlurMask, Canvas, Circle, Points, RadialGradient, vec } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

export type AuraLevel = 'good' | 'warn' | 'bad';

// Neon shades, bright (innermost) -> deep (outer edge); pop additively on dark.
const PALETTES: Record<AuraLevel, string[]> = {
  good: ['#E6FFF6', '#8CFFDD', '#3DF2C0', '#22E0A8', '#16C090', '#0E9E78'],
  warn: ['#FFF1CE', '#FFD86B', '#FFB02E', '#FF9320', '#E87C12', '#C86608'],
  bad: ['#FFE0E7', '#FF9DB2', '#FF4D70', '#FF2E5C', '#E01E4E', '#B81640'],
};
const GOLDEN = 2.399963;

export function AuraBlobView({ level, size = 230 }: { level: AuraLevel; size?: number }) {
  const C = size / 2;
  const R = size * 0.3;
  const N = 100;
  const pal = PALETTES[level];

  const tiers = useMemo(() => {
    const arr: { rr: number; a: number; ph: number; sp: number; wsp: number; wob: number }[][] = [
      [], [], [], [], [], [],
    ];
    for (let i = 0; i < N; i++) {
      const rr = R * Math.sqrt((i + 0.6) / N);
      const tier = Math.min(5, Math.floor((rr / R) * 6));
      arr[tier].push({
        rr,
        a: i * GOLDEN,
        ph: (i * 2.1) % (2 * Math.PI),
        sp: 0.16 + (i % 6) * 0.035,
        wsp: 0.5 + (i % 4) * 0.18,
        wob: 2.5 + (i % 5) * 2.2,
      });
    }
    return arr;
  }, [C, R]);

  const t = useSharedValue(0);
  useFrameCallback((f) => {
    'worklet';
    t.value += (f.timeSincePreviousFrame ?? 16) / 1000;
  });

  const ringPts = (params: typeof tiers[number]) =>
    useDerivedValue(() => {
      'worklet';
      const tt = t.value;
      const rot = tt * 0.12;
      const breath = 1 + Math.sin(tt * 0.5) * 0.05;
      return params.map((p) => {
        const ang = p.a + rot + Math.sin(tt * p.sp + p.ph) * 0.2;
        const rad = (p.rr + Math.sin(tt * p.wsp + p.ph) * p.wob) * breath;
        return { x: C + Math.cos(ang) * rad, y: C + Math.sin(ang) * rad };
      });
    });

  const d0 = ringPts(tiers[0]);
  const d1 = ringPts(tiers[1]);
  const d2 = ringPts(tiers[2]);
  const d3 = ringPts(tiers[3]);
  const d4 = ringPts(tiers[4]);
  const d5 = ringPts(tiers[5]);
  const rings = [d0, d1, d2, d3, d4, d5];

  const glow = useDerivedValue(() => {
    'worklet';
    return 0.45 + (Math.sin(t.value * 0.5) * 0.5 + 0.5) * 0.3;
  });
  const coreR = size * 0.42;

  return (
    <View style={{ width: size, height: size }}>
      <Canvas style={{ width: size, height: size }}>
        {/* soft dark core so the neon pops (cyberpunk) */}
        <Circle cx={C} cy={C} r={coreR}>
          <RadialGradient
            c={vec(C, C)}
            r={coreR}
            colors={['rgba(10,16,28,0.92)', 'rgba(10,16,28,0.55)', 'rgba(10,16,28,0)']}
            positions={[0, 0.6, 1]}
          />
        </Circle>
        {/* additive colored haze */}
        <Circle cx={C} cy={C} r={R * 1.15} color={pal[2]} opacity={glow} blendMode="plus">
          <BlurMask blur={26} style="normal" />
        </Circle>
        {/* particle rings, additive for a neon glow */}
        {rings.map((d, b) => (
          <Points
            key={b}
            points={d}
            mode="points"
            color={pal[b]}
            style="stroke"
            strokeWidth={7.5 - b * 0.9}
            strokeCap="round"
            opacity={0.95 - b * 0.07}
            blendMode="plus"
          />
        ))}
      </Canvas>
    </View>
  );
}

export default AuraBlobView;
