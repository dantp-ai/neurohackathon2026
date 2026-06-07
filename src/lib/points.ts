import type { Domain, GraphPoint } from '@/components/EmbeddingGraph';
import { EegSegment } from '@/types';

/** EEG segments (with UMAP coords) → graph points. health = anomaly_score (0 healthy → 1 unhealthy). */
export function segmentsToPoints(segments: EegSegment[]): GraphPoint[] {
  return segments
    .filter((s) => Number.isFinite(s.umap_x) && Number.isFinite(s.umap_y))
    .map((s) => ({
      id: s.id,
      x: s.umap_x as number,
      y: s.umap_y as number,
      health: Math.max(0, Math.min(1, s.anomaly_score)),
    }));
}

/**
 * Bounding domain of the points. With `clip` > 0, use the [clip, 1-clip]
 * percentile range instead of min/max, so a few far outliers don't shrink the
 * main cluster to a dot (outliers get clamped to the plot edge by the graph).
 */
export function domainOf(points: GraphPoint[], clip = 0): Domain {
  if (points.length === 0) return { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  if (clip > 0 && points.length >= 10) {
    const xs = points.map((p) => p.x).sort((a, b) => a - b);
    const ys = points.map((p) => p.y).sort((a, b) => a - b);
    const lo = Math.floor(clip * (xs.length - 1));
    const hi = Math.ceil((1 - clip) * (xs.length - 1));
    return { xMin: xs[lo], xMax: xs[hi], yMin: ys[lo], yMax: ys[hi] };
  }
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
  for (const p of points) {
    if (p.x < xMin) xMin = p.x;
    if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y;
    if (p.y > yMax) yMax = p.y;
  }
  return { xMin, xMax, yMin, yMax };
}
