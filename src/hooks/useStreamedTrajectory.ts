import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { GraphPoint } from '@/components/EmbeddingGraph';
import { useEegSegments } from '@/hooks/useEegSegments';
import { domainOf, segmentsToPoints } from '@/lib/points';

/**
 * Streams a patient's embedding trajectory in over ACCELERATING time — slow at
 * first (one point at a time), then faster and faster ("time speeding up").
 * Points are revealed in timestamp order (healthy → unhealthy). Drives the demo.
 */
export function useStreamedTrajectory(patientName = 'Trajectory Demo') {
  const { segments, loading, error } = useEegSegments(patientName);
  const all = useMemo(() => segmentsToPoints(segments), [segments]);
  const domain = useMemo(() => domainOf(all), [all]);

  const [shown, setShown] = useState<GraphPoint[]>([]);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const idx = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const tick = useCallback(() => {
    if (idx.current >= all.length) {
      setPlaying(false);
      return;
    }
    idx.current += 1;
    setShown(all.slice(0, idx.current));
    // Accelerating cadence: ~520ms → clamped 25ms as the index grows.
    const interval = Math.max(25, 520 * Math.pow(0.985, idx.current)) / speedRef.current;
    timer.current = setTimeout(tick, interval);
  }, [all]);

  const play = useCallback(() => {
    if (all.length === 0) return;
    if (idx.current >= all.length) idx.current = 0; // restart if finished
    setPlaying(true);
    clearTimer();
    tick();
  }, [all, tick]);

  const pause = useCallback(() => {
    setPlaying(false);
    clearTimer();
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    idx.current = 0;
    setShown([]);
    setPlaying(false);
  }, []);

  useEffect(() => () => clearTimer(), []);

  return {
    shown,
    domain,
    total: all.length,
    count: shown.length,
    playing,
    speed,
    setSpeed,
    play,
    pause,
    reset,
    loading,
    error,
  };
}
