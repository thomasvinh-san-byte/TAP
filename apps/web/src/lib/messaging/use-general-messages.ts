'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GeneralMessage, SenderRole } from '@tap/shared';
import { createClient } from '@/lib/supabase/client';
import { getGeneralMessagesAction, sendGeneralMessageAction } from './actions';
import type { ChatStatus } from './use-ride-messages';

interface UseGeneralMessagesResult {
  messages: GeneralMessage[];
  status: ChatStatus;
  loading: boolean;
  sending: boolean;
  send: (body: string) => Promise<{ error?: string }>;
}

/**
 * Fil de messages temps réel GÉNÉRAL de l'organisation (§5.22 lot A).
 *
 * Un channel PAR organisation (`internal_general_message:{orgId}`, filtre
 * `organization_id=eq.`) : table dédiée, aucun mélange avec le chat à la course.
 * Même socle que `use-ride-messages` (refetch au (re)subscribe et après envoi
 * pour combler un éventuel trou / environnement sans Realtime actif).
 */
export function useGeneralMessages(organizationId: string): UseGeneralMessagesResult {
  const [messages, setMessages] = useState<GeneralMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('connecting');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const loadedOnceRef = useRef(false);

  const refetch = useCallback(async () => {
    const res = await getGeneralMessagesAction();
    if (!res.error) {
      setMessages(res.messages);
    }
    if (!loadedOnceRef.current) {
      loadedOnceRef.current = true;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    void (async () => {
      await refetch();
      if (!active) return;
    })();

    const channel = supabase
      .channel(`internal_general_message:${organizationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_general_message',
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload: { new: Partial<GeneralMessage> & { id?: string } }) => {
          const row = payload.new;
          if (!row.id || !row.created_at || !row.body) return;
          const incoming: GeneralMessage = {
            id: row.id,
            sender_profile_id: row.sender_profile_id ?? '',
            sender_role: (row.sender_role as SenderRole) ?? 'regulateur',
            body: row.body,
            created_at: row.created_at,
          };
          setMessages((current) =>
            current.some((m) => m.id === incoming.id)
              ? current
              : [...current, incoming].sort((a, b) => a.created_at.localeCompare(b.created_at)),
          );
        },
      )
      .subscribe((channelStatus: string) => {
        if (channelStatus === 'SUBSCRIBED') {
          setStatus('connected');
          if (loadedOnceRef.current) void refetch();
        } else if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
          setStatus('reconnecting');
        } else if (channelStatus === 'CLOSED') {
          setStatus('disconnected');
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [organizationId, refetch]);

  const send = useCallback(
    async (body: string): Promise<{ error?: string }> => {
      const trimmed = body.trim();
      if (trimmed.length === 0) return { error: 'Message vide.' };
      setSending(true);
      const res = await sendGeneralMessageAction(trimmed);
      setSending(false);
      if (res.error) return { error: res.error };
      await refetch();
      return {};
    },
    [refetch],
  );

  return { messages, status, loading, sending, send };
}
