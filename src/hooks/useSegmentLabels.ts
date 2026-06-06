import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { LabelSource } from '@/lib/labels';

export type SegmentLabel = {
  id: string;
  segment_id: string | null;
  category: string;
  created_at: string;
};

type Row = { id: string; segment_id: string | null; activity: string; created_at: string };
const toLabel = (r: Row): SegmentLabel => ({
  id: r.id,
  segment_id: r.segment_id,
  category: r.activity,
  created_at: r.created_at,
});

/**
 * Single-category labels for a patient (by display_name). Reads/writes the
 * `labels` table's `activity` column so the continual-learning backend keeps
 * working. Live via Realtime; `add()` applies a label to a chosen segment.
 */
export function useSegmentLabels(displayName?: string) {
  const [labels, setLabels] = useState<SegmentLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const patientId = useRef<string | null>(null);

  useEffect(() => {
    if (!displayName) {
      setLabels([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: user, error: ue } = await supabase
          .from('users')
          .select('id')
          .eq('display_name', displayName)
          .maybeSingle();
        if (ue) throw ue;
        if (!user) {
          if (!cancelled) {
            setLabels([]);
            setLoading(false);
          }
          return;
        }
        patientId.current = user.id;

        const { data, error: le } = await supabase
          .from('labels')
          .select('id, segment_id, activity, created_at')
          .eq('patient_id', user.id)
          .not('activity', 'is', null)
          .order('created_at', { ascending: false });
        if (le) throw le;
        if (cancelled) return;

        setLabels(((data ?? []) as Row[]).map(toLabel));
        setLoading(false);

        channel = supabase
          .channel(`labels:${user.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'labels', filter: `patient_id=eq.${user.id}` },
            (payload) => {
              const r = payload.new as Row;
              if (!r.activity) return;
              setLabels((s) => (s.some((x) => x.id === r.id) ? s : [toLabel(r), ...s]));
            },
          )
          .subscribe();
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [displayName]);

  const add = useCallback(async (category: string, segmentId: string | null, _source: LabelSource) => {
    const cat = category.trim();
    if (!cat || !patientId.current) return;
    const { data, error: e } = await supabase
      .from('labels')
      .insert({
        patient_id: patientId.current,
        segment_id: segmentId,
        activity: cat,
        extraction_method: 'caregiver_manual',
        confidence: 1,
        confirmed_by_caregiver: true,
        confirmed_at: new Date().toISOString(),
      })
      .select('id, segment_id, activity, created_at')
      .single();
    if (e) {
      setError(e.message);
      return;
    }
    const r = data as Row;
    setLabels((s) => (s.some((x) => x.id === r.id) ? s : [toLabel(r), ...s]));
  }, []);

  return { labels, loading, error, add };
}
