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
 * display_name. We look up by name instead of UUID because the rest of the
 * mock data layer still uses string IDs like 'p1' — once Supabase Auth lands
 * this becomes a UUID-by-id lookup.
 */
export function useEegSegments(displayName: string | undefined): State {
  const [state, setState] = useState<State>({ segments: [], loading: true, error: null });

  useEffect(() => {
    if (!displayName) {
      setState({ segments: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
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

        const { data: segs, error: segErr } = await supabase
          .from('eeg_segments')
          .select(
            'id, patient_id, device_id, timestamp_start, duration_s, fatigue, attention, mood, anomaly_score, umap_x, umap_y',
          )
          .eq('patient_id', user.id)
          .order('timestamp_start', { ascending: true });
        if (segErr) throw segErr;

        if (!cancelled) {
          setState({ segments: (segs ?? []) as EegSegment[], loading: false, error: null });
        }
      } catch (e) {
        if (!cancelled) {
          setState({ segments: [], loading: false, error: (e as Error).message });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [displayName]);

  return state;
}
