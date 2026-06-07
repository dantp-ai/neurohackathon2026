/**
 * Web: load CanvasKit first, then dynamically import the Skia implementation
 * (static import would capture an undefined `Skia`). Mirrors SkiaGraph.web /
 * AuraRing.web.
 */
import { useEffect, useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { colors } from '@/theme';
import type { LiveWaveformProps } from './LiveWaveformView';

let skiaPromise: Promise<unknown> | null = null;
const ensureSkia = () => (skiaPromise ??= LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }));

export function LiveWaveform(props: LiveWaveformProps) {
  const [Comp, setComp] = useState<ComponentType<LiveWaveformProps> | null>(null);
  useEffect(() => {
    let active = true;
    ensureSkia()
      .then(() => import('./LiveWaveformView'))
      .then((mod) => {
        if (active) setComp(() => mod.LiveWaveformView);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!Comp) return <View style={{ height: props.height ?? 150, backgroundColor: colors.surfaceAlt, borderRadius: 12 }} />;
  return <Comp {...props} />;
}

export type { LiveWaveformProps, WaveLine } from './LiveWaveformView';
