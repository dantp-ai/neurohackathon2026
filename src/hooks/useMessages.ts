import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { Message, Role } from '@/types';

type State = {
  messages: Message[];
  loading: boolean;
  error: string | null;
  /** The current sender's user id (once resolved) — drives bubble alignment. */
  senderId: string | null;
};

/**
 * Find a user by display_name, creating them if missing. Lets the demo work
 * regardless of seed state. (Replace with Supabase Auth user ids later.)
 */
async function ensureUser(displayName: string, role: Role): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from('users')
    .select('id')
    .eq('display_name', displayName)
    .maybeSingle();
  if (selErr) throw selErr;
  if (existing) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from('users')
    .insert({ display_name: displayName, role })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return created.id;
}

/**
 * Live patient <-> caregiver conversation backed by Supabase, with Realtime so
 * both sides update without a refresh. Identity is resolved by display_name
 * (find-or-create) since the app still uses mock string ids elsewhere.
 */
export function useMessages(patientName: string, caregiverName: string, senderRole: Role) {
  const [state, setState] = useState<State>({
    messages: [],
    loading: true,
    error: null,
    senderId: null,
  });
  // Resolved ids kept in a ref so `send` doesn't need to re-resolve.
  const ids = useRef<{ patientId: string; caregiverId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      try {
        setState((s) => ({ ...s, loading: true, error: null }));
        const [patientId, caregiverId] = await Promise.all([
          ensureUser(patientName, 'patient'),
          ensureUser(caregiverName, 'caregiver'),
        ]);
        if (cancelled) return;
        ids.current = { patientId, caregiverId };
        const senderId = senderRole === 'patient' ? patientId : caregiverId;

        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('patient_id', patientId)
          .eq('caregiver_id', caregiverId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        if (cancelled) return;

        setState({ messages: (data ?? []) as Message[], loading: false, error: null, senderId });

        // Live updates: append any new message for this thread (deduped by id).
        channel = supabase
          .channel(`messages:${patientId}:${caregiverId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `patient_id=eq.${patientId}`,
            },
            (payload) => {
              const msg = payload.new as Message;
              if (msg.caregiver_id !== caregiverId) return;
              setState((s) =>
                s.messages.some((m) => m.id === msg.id)
                  ? s
                  : { ...s, messages: [...s.messages, msg] },
              );
            },
          )
          .subscribe();
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: (e as Error).message }));
        }
      }
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [patientName, caregiverName, senderRole]);

  const send = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || !ids.current || !state.senderId) return;
      const { data, error } = await supabase
        .from('messages')
        .insert({
          patient_id: ids.current.patientId,
          caregiver_id: ids.current.caregiverId,
          sender_id: state.senderId,
          content: trimmed,
        })
        .select('*')
        .single();
      if (error) {
        setState((s) => ({ ...s, error: error.message }));
        return;
      }
      // Optimistic append (deduped against the Realtime echo).
      const msg = data as Message;
      setState((s) =>
        s.messages.some((m) => m.id === msg.id) ? s : { ...s, messages: [...s.messages, msg] },
      );
    },
    [state.senderId],
  );

  return { ...state, send };
}
