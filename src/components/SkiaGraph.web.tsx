/**
 * Web entry: load CanvasKit (WASM) FIRST, then dynamically import EmbeddingGraph
 * so its `Skia` binding resolves to the initialized instance. A static import
 * would evaluate `Skia` before CanvasKit is ready → "undefined (reading 'Matrix')".
 * Props are forwarded so the graph stays fully driven by its caller.
 */
import { useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { colors } from '@/theme';
import type { EmbeddingGraphProps } from './EmbeddingGraph';

let skiaPromise: Promise<unknown> | null = null;
const ensureSkia = () =>
  (skiaPromise ??= LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }));

export function SkiaGraph(props: EmbeddingGraphProps) {
  const [Comp, setComp] = useState<ComponentType<EmbeddingGraphProps> | null>(null);

  useEffect(() => {
    let active = true;
    ensureSkia()
      .then(() => import('./EmbeddingGraph'))
      .then((mod) => {
        if (active) setComp(() => mod.EmbeddingGraph);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!Comp) {
    return (
      <View style={[styles.fallback, { height: props.height ?? 340 }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <Comp {...props} />;
}

const styles = StyleSheet.create({
  fallback: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 16,
  },
});

export default SkiaGraph;

export type { Domain, EmbeddingGraphProps, GraphPoint } from './EmbeddingGraph';
