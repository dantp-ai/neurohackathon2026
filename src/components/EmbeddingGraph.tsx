/**
 * EmbeddingGraph — 2D embedding map drawn with Skia.
 *
 * Points are plain <Circle>s over a faint grid, colored healthy → unhealthy
 * (green → amber → red). Optional: kNN graph edges, tap-to-select (clinician
 * labeling), pan + pinch-zoom (`interactive`), and an "adding" pulse aura on the
 * newest point (`pulseId`, used by the patient view).
 */
import { useEffect, useMemo, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/theme';

export type GraphPoint = { id: string; x: number; y: number; health: number };
export type Domain = { xMin: number; xMax: number; yMin: number; yMax: number };

export type EmbeddingGraphProps = {
  points: GraphPoint[];
  domain?: Domain;
  showEdges?: boolean;
  k?: number;
  height?: number;
  selectedId?: string | null;
  onSelectPoint?: (id: string) => void;
  /** Enable pan + pinch-zoom. */
  interactive?: boolean;
  /** Faint background grid. */
  grid?: boolean;
  /** Draw an expanding "adding" aura on this point (e.g. the newest one). */
  pulseId?: string | null;
  /** Point radius (default 6). */
  pointRadius?: number;
  /** Point opacity (default 1) — slight transparency reads better on dense clouds. */
  pointOpacity?: number;
};

const R = 6;
const PAD = 26;
const HEALTH_RGB: [number, number, number][] = [
  [46, 166, 107],
  [232, 163, 23],
  [214, 69, 69],
];

function healthColor(t: number): string {
  const x = Math.max(0, Math.min(1, t));
  const seg = x <= 0.5 ? 0 : 1;
  const lt = x <= 0.5 ? x / 0.5 : (x - 0.5) / 0.5;
  const a = HEALTH_RGB[seg];
  const b = HEALTH_RGB[seg + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * lt);
  const g = Math.round(a[1] + (b[1] - a[1]) * lt);
  const bl = Math.round(a[2] + (b[2] - a[2]) * lt);
  return `rgb(${r}, ${g}, ${bl})`;
}

function defaultDomain(points: GraphPoint[]): Domain {
  if (points.length === 0) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const p of points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  return { xMin, xMax, yMin, yMax };
}

type Entry = { id: string; sx: number; sy: number; color: string };

function knnEdges(pos: { sx: number; sy: number }[], k: number): [number, number][] {
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (let i = 0; i < pos.length; i++) {
    const dists: { j: number; d: number }[] = [];
    for (let j = 0; j < pos.length; j++) {
      if (i === j) continue;
      const dx = pos[i].sx - pos[j].sx;
      const dy = pos[i].sy - pos[j].sy;
      dists.push({ j, d: dx * dx + dy * dy });
    }
    dists.sort((a, b) => a.d - b.d);
    for (let n = 0; n < Math.min(k, dists.length); n++) {
      const j = dists[n].j;
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (!seen.has(key)) {
        seen.add(key);
        edges.push([i, j]);
      }
    }
  }
  return edges;
}

export function EmbeddingGraph({
  points,
  domain,
  showEdges = false,
  k = 3,
  height = 340,
  selectedId,
  onSelectPoint,
  interactive = false,
  grid = true,
  pulseId,
  pointRadius,
  pointOpacity,
}: EmbeddingGraphProps) {
  const pr = pointRadius ?? R;
  const [size, setSize] = useState({ w: 0, h: height });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const dom = useMemo(() => domain ?? defaultDomain(points), [domain, points]);

  const entries = useMemo<Entry[]>(() => {
    const { w, h } = size;
    if (w === 0) return [];
    const xR = Math.max(dom.xMax - dom.xMin, 1e-6);
    const yR = Math.max(dom.yMax - dom.yMin, 1e-6);
    return points.map((p) => ({
      id: p.id,
      sx: PAD + ((p.x - dom.xMin) / xR) * (w - 2 * PAD),
      sy: PAD + (1 - (p.y - dom.yMin) / yR) * (h - 2 * PAD),
      color: healthColor(p.health),
    }));
  }, [points, size, dom]);

  const edgePath = useMemo(() => {
    if (!showEdges || entries.length < 2) return null;
    const path = Skia.Path.Make();
    for (const [a, b] of knnEdges(entries, k)) {
      path.moveTo(entries[a].sx, entries[a].sy);
      path.lineTo(entries[b].sx, entries[b].sy);
    }
    return path;
  }, [entries, showEdges, k]);

  const gridPath = useMemo(() => {
    if (!grid || size.w === 0) return null;
    const path = Skia.Path.Make();
    const stepX = (size.w - 2 * PAD) / 6;
    const stepY = (size.h - 2 * PAD) / 6;
    for (let i = 0; i <= 6; i++) {
      const x = PAD + i * stepX;
      path.moveTo(x, PAD);
      path.lineTo(x, size.h - PAD);
      const y = PAD + i * stepY;
      path.moveTo(PAD, y);
      path.lineTo(size.w - PAD, y);
    }
    return path;
  }, [grid, size]);

  const selected = useMemo(
    () => (selectedId ? entries.find((e) => e.id === selectedId) : undefined),
    [entries, selectedId],
  );
  const pulsed = useMemo(
    () => (pulseId ? entries.find((e) => e.id === pulseId) : undefined),
    [entries, pulseId],
  );

  // --- pan / zoom ---------------------------------------------------------
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startK = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const transform = useDerivedValue(() => [
    { translateX: tx.value },
    { translateY: ty.value },
    { scale: scale.value },
  ]);

  const selectNearest = (lx: number, ly: number) => {
    if (!onSelectPoint || entries.length === 0) return;
    const bx = (lx - tx.value) / scale.value;
    const by = (ly - ty.value) / scale.value;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < entries.length; i++) {
      const dx = entries[i].sx - bx;
      const dy = entries[i].sy - by;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0 && bestD <= (30 / scale.value) ** 2) onSelectPoint(entries[best].id);
  };

  const pan = Gesture.Pan()
    .onBegin(() => {
      'worklet';
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      'worklet';
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    });
  const pinch = Gesture.Pinch()
    .onBegin(() => {
      'worklet';
      startK.value = scale.value;
    })
    .onUpdate((e) => {
      'worklet';
      scale.value = Math.max(0.6, Math.min(6, startK.value * e.scale));
    });
  const tap = Gesture.Tap()
    .maxDuration(250)
    .onEnd((e) => {
      'worklet';
      runOnJS(selectNearest)(e.x, e.y);
    });
  const gesture = Gesture.Race(tap, Gesture.Simultaneous(pan, pinch));

  // --- adding-pulse aura --------------------------------------------------
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
  }, [pulse]);
  const pulseR = useDerivedValue(() => pr + 4 + pulse.value * 18);
  const pulseOpacity = useDerivedValue(() => (1 - pulse.value) * 0.65);

  const canvas = (
    <Canvas style={{ width: size.w, height: size.h }}>
      {gridPath && <Path path={gridPath} style="stroke" strokeWidth={1} color="rgba(120,130,140,0.13)" />}
      <Group transform={interactive ? transform : undefined}>
        {edgePath && (
          <Path path={edgePath} style="stroke" strokeWidth={1} color="rgba(120,130,140,0.35)" />
        )}
        {entries.map((e, i) => (
          <Circle key={i} cx={e.sx} cy={e.sy} r={pr} color={e.color} opacity={pointOpacity} />
        ))}
        {pulsed && (
          <Circle
            cx={pulsed.sx}
            cy={pulsed.sy}
            r={pulseR}
            color={pulsed.color}
            opacity={pulseOpacity}
            style="stroke"
            strokeWidth={2.5}
          />
        )}
        {selected && (
          <>
            <Circle cx={selected.sx} cy={selected.sy} r={pr + 5} style="stroke" strokeWidth={3} color="#0B1220" />
            <Circle cx={selected.sx} cy={selected.sy} r={pr + 5} style="stroke" strokeWidth={1.5} color="#FFFFFF" />
          </>
        )}
      </Group>
    </Canvas>
  );

  return (
    <View style={[styles.wrap, { height }]} onLayout={onLayout}>
      {size.w > 0 && (interactive ? <GestureDetector gesture={gesture}>{canvas}</GestureDetector> : canvas)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
});

export default EmbeddingGraph;
