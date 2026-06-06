import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { LabelSource } from '@/lib/labels';

export type Who = 'clinician' | 'patient';

export type SegmentLabel = {
  id: string;
  segment_id: string | null;
  category: string;
  created_at: string;
  source: Who | null;
};

type Row = { id: string; segment_id: string | null; activity: string; created_at: string; source: Who | null };
const toLabel = (r: Row): SegmentLabel => ({
  id: r.id,
  segment_id: r.segment_id,
  category: r.activity,
  created_at: r.created_at,
  source: r.source,
});

/**
 * Single-category labels for a patient (by display_name). Reads/writes the
 * `labels` table's `activity` column so the continual-learning backend keeps
 * working. `source` distinguishes clinician vs patient (check-in) labels. Live
 * via Realtime; `add()` applies a label, `update()` edits one.
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
          .select('id, segment_id, activity, created_at, source')
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
            { event: '*', schema: 'public', table: 'labels', filter: `patient_id=eq.${user.id}` },
            (payload) => {
              if (payload.eventType === 'DELETE') {
                const id = (payload.old as { id: string }).id;
                setLabels((s) => s.filter((x) => x.id !== id));
                return;
              }
              const r = payload.new as Row;
              if (!r.activity) return;
              setLabels((s) => {
                const rest = s.filter((x) => x.id !== r.id);
                return [toLabel(r), ...rest].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
              });
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

  const add = useCallback(
    async (category: string, segmentId: string | null, _entry: LabelSource, who: Who = 'clinician') => {
      const cat = category.trim();
      if (!cat || !patientId.current) return;
      const { data, error: e } = await supabase
        .from('labels')
        .insert({
          patient_id: patientId.current,
          segment_id: segmentId,
          activity: cat,
          extraction_method: who === 'patient' ? 'llm_auto' : 'caregiver_manual',
          confidence: 1,
          confirmed_by_caregiver: who === 'clinician',
          confirmed_at: new Date().toISOString(),
          source: who,
        })
        .select('id, segment_id, activity, created_at, source')
        .single();
      if (e) {
        setError(e.message);
        return;
      }
      const r = data as Row;
      setLabels((s) => (s.some((x) => x.id === r.id) ? s : [toLabel(r), ...s]));
    },
    [],
  );

  const update = useCallback(async (id: string, category: string) => {
    const cat = category.trim();
    if (!cat) return;
    const { error: e } = await supabase.from('labels').update({ activity: cat }).eq('id', id);
    if (e) {
      setError(e.message);
      return;
    }
    setLabels((s) => s.map((l) => (l.id === id ? { ...l, category: cat } : l)));
  }, []);

  return { labels, loading, error, add, update };
}
