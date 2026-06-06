/**
 * Web: load CanvasKit (WASM) once at app start and gate the app until it's ready,
 * so every Skia component (AuraRing, embedding maps) has `Skia` available before
 * it renders. Without this, a Skia component that renders before CanvasKit loads
 * crashes with "Cannot read properties of undefined (reading 'Path')".
 */
import { ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { colors } from '@/theme';

let promise: Promise<unknown> | null = null;
const ensureSkia = () => (promise ??= LoadSkiaWeb({ locateFile: (f: string) => `/${f}` }));

export function SkiaProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    ensureSkia().then(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  return <>{children}</>;
}

export default SkiaProvider;
