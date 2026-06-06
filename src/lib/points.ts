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

export function domainOf(points: GraphPoint[]): Domain {
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
