import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme';

/** Deterministic hash so each row's sample looks stable across renders. */
function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * A tiny, deterministic EEG-like waveform (stand-in for the neurodsp sample that
 * was labeled), drawn as an SVG sparkline. Seeded by the row id so it's stable.
 */
export function SampleWave({
  seed,
  color = colors.primary,
  width = 70,
  height = 28,
}: {
  seed: string;
  color?: string;
  width?: number;
  height?: number;
}) {
  const h = hashSeed(seed);
  const f1 = 2 + (h % 4);
  const f2 = 6 + ((h >> 2) % 5);
  const pad = 3;
  const mid = height / 2;
  const amp = height / 2 - pad;
  const n = 56;
  let d = '';
  for (let i = 0; i <= n; i++) {
    const x = pad + (i / n) * (width - 2 * pad);
    const t = (i / n) * Math.PI * 2;
    const noise = ((h >> (i % 24)) & 1 ? 0.14 : -0.14) * ((i % 5) - 2) * 0.5;
    const r = Math.sin(t * f1 + h) * 0.55 + Math.sin(t * f2 + (h >> 3)) * 0.3 + noise;
    const y = mid - r * amp * 0.82;
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)} `;
  }
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}

export default SampleWave;
