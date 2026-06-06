/**
 * Native/default entry: Skia is available immediately, so use EmbeddingGraph
 * directly. The web build uses SkiaGraph.web.tsx which loads CanvasKit first and
 * dynamically imports EmbeddingGraph so its `Skia` binding is initialized.
 */
export { EmbeddingGraph as SkiaGraph } from './EmbeddingGraph';
export type { Domain, EmbeddingGraphProps, GraphPoint } from './EmbeddingGraph';
