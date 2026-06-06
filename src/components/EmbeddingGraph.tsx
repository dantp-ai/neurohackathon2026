/**
 * EmbeddingGraph — 2D embedding map drawn with Skia.
 *
 * Deliberately simple + reliable: each point is a plain <Circle> drawn directly
 * into the <Canvas>, colored on a healthy → unhealthy scale (green → amber → red).
 * Streaming-friendly: pass a growing `points` array and new points just appear.
 * Optional kNN graph edges via a single <Path>. Optional tap-to-select: tap a
 * point and `onSelectPoint(id)` fires (used by the clinician labeling flow).
 *
 * (We avoided Atlas/RSXform/animated-matrix here — they didn't render reliably on
 * Expo web; per-point <Circle> is the robust path and fine for these counts.)
 */
import { useMemo, useState } from 'react';
import { GestureResponderEvent, LayoutChangeEvent, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';

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
  /** Currently highlighted point id (drawn with a ring). */
  selectedId?: string | null;
  /** Tap a point to select it. */
  onSelectPoint?: (id: string) => void;
};

const R = 6;
const PAD = 26;
const HEALTH_RGB: [number, number, number][] = [
  [46, 166, 107], // statusGood  #2EA66B
  [232, 163, 23], // statusWarn  #E8A317
  [214, 69, 69], // statusBad   #D64545
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
}: EmbeddingGraphProps) {
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

  const selected = useMemo(
    () => (selectedId ? entries.find((e) => e.id === selectedId) : undefined),
    [entries, selectedId],
  );

  const handleTap = (e: GestureResponderEvent) => {
    if (!onSelectPoint || entries.length === 0) return;
    const { locationX, locationY } = e.nativeEvent;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < entries.length; i++) {
      const dx = entries[i].sx - locationX;
      const dy = entries[i].sy - locationY;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0 && bestD <= 30 * 30) onSelectPoint(entries[best].id);
  };

  return (
    <View
      style={[styles.wrap, { height }]}
      onLayout={onLayout}
      onStartShouldSetResponder={() => !!onSelectPoint}
      onResponderRelease={handleTap}
    >
      {size.w > 0 && (
        <Canvas style={{ width: size.w, height: size.h }}>
          {edgePath && (
            <Path path={edgePath} style="stroke" strokeWidth={1} color="rgba(120,130,140,0.35)" />
          )}
          {entries.map((e, i) => (
            <Circle key={i} cx={e.sx} cy={e.sy} r={R} color={e.color} />
          ))}
          {selected && (
            <>
              <Circle cx={selected.sx} cy={selected.sy} r={R + 5} style="stroke" strokeWidth={3} color="#0B1220" />
              <Circle cx={selected.sx} cy={selected.sy} r={R + 5} style="stroke" strokeWidth={1.5} color="#FFFFFF" />
            </>
          )}
        </Canvas>
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
});

export default EmbeddingGraph;
