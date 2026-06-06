/**
 * EmbeddingGraph — high-performance animated 2D embedding map (Skia).
 *
 * Renders the EEG embedding point-cloud the way the research recommended:
 *   - ONE Skia <Atlas> instanced draw for all points (not a component per point)
 *   - per-point spring "bounce-in" written into the RSXform buffer on the UI thread
 *   - a single <Path> for the kNN graph edges
 *   - one matrix on the parent <Group> for pan + pinch-zoom
 *   - per-point color on a healthy → unhealthy scale (green → amber → red)
 *
 * Streaming-friendly: pass a growing `points` array (e.g. one new point per tick);
 * each newly-seen id springs in with an overshoot ("blobby") feel. Pass a stable
 * `domain` so streamed points land in consistent positions instead of jumping.
 *
 * Note: Skia renders natively (iOS/Android dev build) and on web via CanvasKit.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View } from 'react-native';
import {
  Atlas,
  Canvas,
  Circle,
  Group,
  Path,
  Skia,
  rect,
  useRSXformBuffer,
  useTexture,
} from '@shopify/react-native-skia';
import {
  makeMutable,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { colors } from '@/theme';

export type GraphPoint = { id: string; x: number; y: number; health: number };
export type Domain = { xMin: number; xMax: number; yMin: number; yMax: number };

export type EmbeddingGraphProps = {
  points: GraphPoint[];
  /** Stable coordinate domain so streamed points keep fixed positions. */
  domain?: Domain;
  showEdges?: boolean;
  /** neighbors per node for the kNN graph */
  k?: number;
  height?: number;
};

const R = 7; // sprite radius (world units)
const PAD = 28;

// healthy → unhealthy gradient: green → amber → red (theme status palette as RGB).
const HEALTH_RGB: [number, number, number][] = [
  [46, 166, 107], // statusGood  #2EA66B
  [232, 163, 23], // statusWarn  #E8A317
  [214, 69, 69], // statusBad   #D64545
];

function healthColor(t: number) {
  const x = Math.max(0, Math.min(1, t));
  const seg = x <= 0.5 ? 0 : 1;
  const lt = x <= 0.5 ? x / 0.5 : (x - 0.5) / 0.5;
  const a = HEALTH_RGB[seg];
  const b = HEALTH_RGB[seg + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * lt);
  const g = Math.round(a[1] + (b[1] - a[1]) * lt);
  const bl = Math.round(a[2] + (b[2] - a[2]) * lt);
  return Skia.Color(`rgb(${r}, ${g}, ${bl})`);
}

type Entry = { sx: number; sy: number; appear: SharedValue<number>; color: ReturnType<typeof Skia.Color> };

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

/** Undirected kNN edges (brute force; fine for a few hundred points). */
function knnEdges(pos: { x: number; y: number }[], k: number): [number, number][] {
  const seen = new Set<string>();
  const edges: [number, number][] = [];
  for (let i = 0; i < pos.length; i++) {
    const dists: { j: number; d: number }[] = [];
    for (let j = 0; j < pos.length; j++) {
      if (i === j) continue;
      const dx = pos[i].x - pos[j].x;
      const dy = pos[i].y - pos[j].y;
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

export function EmbeddingGraph({ points, domain, showEdges = true, k = 3, height = 340 }: EmbeddingGraphProps) {
  const [size, setSize] = useState({ w: 0, h: height });
  const onLayout = (e: LayoutChangeEvent) =>
    setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  // Persist a spring per point id across renders / streaming inserts.
  const springs = useRef<Map<string, SharedValue<number>>>(new Map());

  const dom = useMemo(() => domain ?? defaultDomain(points), [domain, points]);

  // Screen-space entries; recomputed on points/size/domain change (cheap).
  const entries = useMemo<Entry[]>(() => {
    const { w, h } = size;
    if (w === 0) return [];
    const xR = Math.max(dom.xMax - dom.xMin, 1e-6);
    const yR = Math.max(dom.yMax - dom.yMin, 1e-6);
    return points.map((p) => {
      let appear = springs.current.get(p.id);
      if (!appear) {
        appear = makeMutable(0);
        springs.current.set(p.id, appear);
      }
      const sx = PAD + ((p.x - dom.xMin) / xR) * (w - 2 * PAD);
      const sy = PAD + (1 - (p.y - dom.yMin) / yR) * (h - 2 * PAD);
      return { sx, sy, appear, color: healthColor(p.health) };
    });
  }, [points, size, dom]);

  // Kick the spring of any newly-added point (overshoot bounce-in).
  useEffect(() => {
    for (const p of points) {
      const s = springs.current.get(p.id);
      if (s && s.value === 0) {
        s.value = withSpring(1, { damping: 9, stiffness: 150, mass: 0.6 });
      }
    }
  }, [points]);

  const texture = useTexture(<Circle cx={R} cy={R} r={R} color="white" />, {
    width: 2 * R,
    height: 2 * R,
  });

  const sprites = useMemo(() => entries.map(() => rect(0, 0, 2 * R, 2 * R)), [entries.length]);
  const pointColors = useMemo(() => entries.map((e) => e.color), [entries]);

  const transforms = useRSXformBuffer(entries.length, (val, i) => {
    'worklet';
    const e = entries[i];
    const s = e.appear.value; // 0 → ~1.1 overshoot
    val.set(s, 0, e.sx - R * s, e.sy - R * s);
  });

  const edgePath = useMemo(() => {
    if (!showEdges || entries.length < 2) return null;
    const path = Skia.Path.Make();
    const edges = knnEdges(entries.map((e) => ({ x: e.sx, y: e.sy })), k);
    for (const [a, b] of edges) {
      path.moveTo(entries[a].sx, entries[a].sy);
      path.lineTo(entries[b].sx, entries[b].sy);
    }
    return path;
  }, [entries, showEdges, k]);

  // Pan + pinch → one matrix for the whole scene.
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const scale = useSharedValue(1);
  const pan = Gesture.Pan().onChange((e) => {
    tx.value += e.changeX;
    ty.value += e.changeY;
  });
  const pinch = Gesture.Pinch().onChange((e) => {
    scale.value = Math.max(0.4, Math.min(6, scale.value * (e.scaleChange ?? 1)));
  });
  const gesture = Gesture.Simultaneous(pan, pinch);
  const matrix = useDerivedValue(() => {
    const m = Skia.Matrix();
    m.translate(tx.value, ty.value);
    m.scale(scale.value, scale.value);
    return m;
  });

  return (
    <View style={[styles.wrap, { height }]} onLayout={onLayout}>
      {size.w > 0 && (
        <GestureDetector gesture={gesture}>
          <Canvas style={styles.canvas}>
            <Group matrix={matrix}>
              {edgePath && (
                <Path path={edgePath} style="stroke" strokeWidth={1} color="rgba(120,130,140,0.35)" />
              )}
              <Atlas image={texture} sprites={sprites} transforms={transforms} colors={pointColors} />
            </Group>
          </Canvas>
        </GestureDetector>
      )}
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
  canvas: { flex: 1 },
});

export default EmbeddingGraph;
