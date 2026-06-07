// Viridis colormap (perceptually-uniform) — used to color the patient embedding
// by time (start of monitoring → now). Plain module (no Skia) so screens can
// import it for the legend without pulling the Skia bundle on web.
const VIRIDIS: [number, number, number][] = [
  [68, 1, 84],
  [59, 82, 139],
  [33, 145, 140],
  [94, 201, 98],
  [253, 231, 37],
];

export function viridis(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(x));
  const f = x - i;
  const a = VIRIDIS[i];
  const b = VIRIDIS[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)}, ${Math.round(a[1] + (b[1] - a[1]) * f)}, ${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}
