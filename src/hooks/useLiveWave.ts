import { useEffect, useRef, useState } from 'react';

/**
 * A scrolling waveform for the live-monitor charts. When `active`, every tick it
 * appends a new sine+noise sample and drops the oldest (the line "moves"); when
 * inactive it freezes. `phase` offsets multiple waves so they don't overlap.
 */
export function useLiveWave(
  active: boolean,
  opts: { base: number; amp: number; length?: number; phase?: number; periodMs?: number },
): number[] {
  const { base, amp, length = 24, phase = 0, periodMs = 700 } = opts;
  const [vals, setVals] = useState<number[]>(() =>
    Array.from({ length }, (_, i) => base + amp * Math.sin(i * 0.5 + phase)),
  );
  const t = useRef(length);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      t.current += 1;
      const v = base + amp * Math.sin(t.current * 0.5 + phase) + (Math.random() - 0.5) * amp * 0.5;
      setVals((s) => [...s.slice(1), v]);
    }, periodMs);
    return () => clearInterval(id);
  }, [active, base, amp, phase, periodMs]);
  return vals;
}
