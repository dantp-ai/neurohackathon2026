/**
 * LiveWaveformView — a smooth, continuously-scrolling multi-line waveform drawn
 * with Skia and animated on the UI thread (useFrameCallback), so it never
 * stutters and pauses exactly in place when `active` flips to false (resumes
 * from the same offset). Used for the patient Last-hour + Heart-rate streams.
 */
import { useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Canvas, Group, Path, Skia } from '@shopify/react-native-skia';
import { useDerivedValue, useFrameCallback, useSharedValue } from 'react-native-reanimated';

import { colors } from '@/theme';

export type WaveLine = { color: string; base: number; amp: number; cycles: number; phase?: number };
export type LiveWaveformProps = {
  lines: WaveLine[];
  active: boolean;
  min: number;
  max: number;
  height?: number;
  speed?: number; // px / second
};

const PAD = 14;

function buildPath(W: number, H: number, line: WaveLine, min: number, max: number) {
  const p = Skia.Path.Make();
  const span = W * 2;
  const range = Math.max(max - min, 1e-6);
  const ph = line.phase ?? 0;
  for (let x = 0; x <= span; x += 3) {
    const theta = (x / W) * line.cycles * 2 * Math.PI + ph;
    const v = line.base + line.amp * (Math.sin(theta) + 0.22 * Math.sin(2 * theta));
    const y = PAD + (1 - (v - min) / range) * (H - 2 * PAD);
    if (x === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  return p;
}

export function LiveWaveformView({ lines, active, min, max, height = 150, speed = 42 }: LiveWaveformProps) {
  const [size, setSize] = useState({ w: 0, h: height });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const paths = useMemo(
    () => (size.w === 0 ? [] : lines.map((l) => buildPath(size.w, size.h, l, min, max))),
    [lines, size, min, max],
  );
  const gridPath = useMemo(() => {
    if (size.w === 0) return null;
    const p = Skia.Path.Make();
    for (let i = 0; i <= 4; i++) {
      const y = PAD + (i / 4) * (size.h - 2 * PAD);
      p.moveTo(0, y);
      p.lineTo(size.w, y);
    }
    return p;
  }, [size]);

  const offset = useSharedValue(0);
  const wSV = useSharedValue(0);
  const activeSV = useSharedValue(active ? 1 : 0);
  wSV.value = size.w;
  activeSV.value = active ? 1 : 0;

  useFrameCallback((frame) => {
    'worklet';
    if (!activeSV.value || wSV.value === 0) return;
    const dt = (frame.timeSincePreviousFrame ?? 16) / 1000;
    let o = offset.value - speed * dt;
    if (o <= -wSV.value) o += wSV.value;
    offset.value = o;
  });
  const transform = useDerivedValue(() => [{ translateX: offset.value }]);

  return (
    <View style={[styles.wrap, { height }]} onLayout={onLayout}>
      {size.w > 0 && (
        <Canvas style={{ width: size.w, height: size.h }}>
          {gridPath && <Path path={gridPath} style="stroke" strokeWidth={1} color="rgba(120,130,140,0.14)" />}
          <Group transform={transform}>
            {paths.map((p, i) => (
              <Path key={i} path={p} style="stroke" strokeWidth={2.5} strokeCap="round" strokeJoin="round" color={lines[i].color} />
            ))}
          </Group>
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surfaceAlt },
});

export default LiveWaveformView;
