import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { EegSegment } from '@/types';

type State = {
  segments: EegSegment[];
  loading: boolean;
  error: string | null;
};

/**
 * Fetches EEG segments (with UMAP coords) for a patient identified by
 * display_name, then subscribes to Realtime INSERTs so points streamed in by the
 * pipeline/controller appear live without a refresh. We look up by name instead
 * of UUID because the mock data layer still uses string IDs like 'p1'.
 */
export function useEegSegments(displayName: string | undefined): State {
  const [state, setState] = useState<State>({ segments: [], loading: true, error: null });

  useEffect(() => {
    if (!displayName) {
      setState({ segments: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const { data: user, error: userErr } = await supabase
          .from('users')
          .select('id')
          .eq('display_name', displayName)
          .maybeSingle();
        if (userErr) throw userErr;
        if (!user) {
          if (!cancelled) setState({ segments: [], loading: false, error: null });
          return;
        }

        const cols =
          'id, patient_id, device_id, timestamp_start, duration_s, fatigue, attention, mood, anomaly_score, umap_x, umap_y';
        const { data: segs, error: segErr } = await supabase
          .from('eeg_segments')
          .select(cols)
          .eq('patient_id', user.id)
          .order('timestamp_start', { ascending: true });
        if (segErr) throw segErr;
        if (cancelled) return;

        setState({ segments: (segs ?? []) as EegSegment[], loading: false, error: null });

        // Live: append newly streamed segments (deduped, kept in time order).
        channel = supabase
          .channel(`eeg_segments:${user.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'eeg_segments', filter: `patient_id=eq.${user.id}` },
            (payload) => {
              const seg = payload.new as EegSegment;
              if (seg.umap_x == null || seg.umap_y == null) return;
              setState((s) =>
                s.segments.some((x) => x.id === seg.id)
                  ? s
                  : { ...s, segments: [...s.segments, seg] },
              );
            },
          )
          .subscribe();
      } catch (e) {
        if (!cancelled) setState({ segments: [], loading: false, error: (e as Error).message });
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [displayName]);

  return state;
}
