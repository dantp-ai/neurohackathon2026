import { ReactNode } from 'react';

/** Native: Skia is ready immediately — just pass through. (Web variant loads CanvasKit.) */
export function SkiaProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export default SkiaProvider;
