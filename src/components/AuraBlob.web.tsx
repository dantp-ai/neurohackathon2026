/**
 * Web: load CanvasKit first, then dynamically import the Skia implementation
 * (static import would capture an undefined `Skia`). Mirrors AuraRing.web.
 */
import { useEffect, useState, type ComponentType } from 'react';
import { View } from 'react-native';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import type { AuraLevel } from './AuraBlobView';

type Props = { level: AuraLevel; size?: number };

let skiaPromise: Promise<unknown> | null = null;
const ensureSkia = () => (skiaPromise ??= LoadSkiaWeb({ locateFile: (file: string) => `/${file}` }));

export function AuraBlob(props: Props) {
  const [Comp, setComp] = useState<ComponentType<Props> | null>(null);
  useEffect(() => {
    let active = true;
    ensureSkia()
      .then(() => import('./AuraBlobView'))
      .then((mod) => {
        if (active) setComp(() => mod.AuraBlobView);
      });
    return () => {
      active = false;
    };
  }, []);
  if (!Comp) return <View style={{ width: props.size ?? 230, height: props.size ?? 230 }} />;
  return <Comp {...props} />;
}

export type { AuraLevel } from './AuraBlobView';
