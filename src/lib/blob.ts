import type { GraphPoint } from '@/components/EmbeddingGraph';

export type BlobPoint = GraphPoint & { tISO: string };

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// ~N(0, 0.5) from three uniforms.
const gauss = (rng: () => number) => rng() + rng() + rng() - 1.5;

/** A stable random Gaussian blob of points for a patient's embedding map. */
export function generateBlob(seed: string, n = 44): BlobPoint[] {
  const rng = mulberry32(hashStr(seed));
  const now = Date.now();
  const pts: BlobPoint[] = [];
  for (let i = 0; i < n; i++) {
    pts.push({
      id: `b-${seed}-${i}`,
      x: gauss(rng) * 1.7,
      y: gauss(rng) * 1.7,
      health: Math.max(0, Math.min(1, 0.35 + gauss(rng) * 0.3)),
      tISO: new Date(now - (n - i) * 60_000).toISOString(),
    });
  }
  return pts;
}

/** A new streamed point near the cluster, or (with `outlierChance`) a far outlier. */
export function nextBlobPoint(blob: BlobPoint[], outlierChance = 0.18): BlobPoint {
  const now = Date.now();
  const id = `live-${now}-${Math.floor(Math.random() * 1e6)}`;
  if (Math.random() < outlierChance) {
    const ang = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 2.2;
    return { id, x: Math.cos(ang) * r, y: Math.sin(ang) * r, health: 0.7 + Math.random() * 0.3, tISO: new Date(now).toISOString() };
  }
  const near = blob[Math.floor(Math.random() * blob.length)] ?? { x: 0, y: 0, health: 0.4 };
  return {
    id,
    x: near.x + (Math.random() - 0.5) * 0.9,
    y: near.y + (Math.random() - 0.5) * 0.9,
    health: Math.max(0, Math.min(1, near.health + (Math.random() - 0.5) * 0.25)),
    tISO: new Date(now).toISOString(),
  };
}
