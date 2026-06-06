/**
 * Web entry: load CanvasKit (WASM) FIRST, then dynamically import the Skia
 * implementation so its `Skia` binding resolves to the initialized instance. A
 * static import would capture `Skia` before CanvasKit is ready → "undefined
 * (reading 'Path')". Mirrors SkiaGraph.web.
 */
import { useEffect, useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import type { AuraRingProps } from './AuraRingView';

let skiaPromise: Promise<unknown> | null = null;
const ensureSkia = () => (skiaPromise ??= LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }));

export function AuraRing(props: AuraRingProps) {
  const [Comp, setComp] = useState<ComponentType<AuraRingProps> | null>(null);

  useEffect(() => {
    let active = true;
    ensureSkia()
      .then(() => import('./AuraRingView'))
      .then((mod) => {
        if (active) setComp(() => mod.AuraRingView);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!Comp) return <View style={{ width: 220, height: 220 }} />;
  return <Comp {...props} />;
}

export type { AuraLevel, AuraRingProps } from './AuraRingView';
