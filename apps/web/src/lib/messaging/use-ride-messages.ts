'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RideMessage, SenderRole } from '@tap/shared';
import { createClient } from '@/lib/supabase/client';
import { getRideMessagesAction, sendRideMessageAction } from './actions';

export type ChatStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

interface UseRideMessagesResult {
  messages: RideMessage[];
  status: ChatStatus;
  loading: boolean;
  sending: boolean;
  send: (body: string) => Promise<{ error?: string }>;
}

/**
 * Fil de messages temps réel d'une course (Phase 06.41, DEC-120).
 *
 * Un channel PAR course (`internal_message:{rideId}`, filtre `ride_id=eq.`)
 * pour ne recevoir QUE les messages de cette conversation (la course EST la
 * conversation — évite le bug Supabase #1721 de payloads mélangés).
 *
 * Reconnexion : à chaque (re)SUBSCRIBED on refait le fetch initial pour
 * combler un éventuel trou pendant la coupure (pattern cockpit + refetch).
 * Après un envoi réussi on refetch aussi : le message apparaît même si la
 * publication Realtime n'est pas active dans l'environnement.
 */
export function useRideMessages(rideId: string): UseRideMessagesResult {
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>('connecting');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const loadedOnceRef = useRef(false);

  const refetch = useCallback(async () => {
    const res = await getRideMessagesAction(rideId);
    if (!res.error) {
      setMessages(res.messages);
    }
    if (!loadedOnceRef.current) {
      loadedOnceRef.current = true;
      setLoading(false);
    }
  }, [rideId]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    void (async () => {
      await refetch();
      if (!active) return;
    })();

    const channel = supabase
      .channel(`internal_message:${rideId}`)
      .on(
        'postgres_changes' as never,
        {
          event: 'INSERT',
          schema: 'public',
          table: 'internal_message',
          filter: `ride_id=eq.${rideId}`,
        },
        (payload: { new: Partial<RideMessage> & { id?: string } }) => {
          const row = payload.new;
          if (!row.id || !row.created_at || !row.body) return;
          const incoming: RideMessage = {
            id: row.id,
            ride_id: row.ride_id ?? rideId,
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
          // (re)synchronise au branchement initial ET à chaque reconnexion.
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
  }, [rideId, refetch]);

  const send = useCallback(
    async (body: string): Promise<{ error?: string }> => {
      const trimmed = body.trim();
      if (trimmed.length === 0) return { error: 'Message vide.' };
      setSending(true);
      const res = await sendRideMessageAction(rideId, trimmed);
      setSending(false);
      if (res.error) return { error: res.error };
      // Filet : rend le message visible même sans propagation Realtime.
      await refetch();
      return {};
    },
    [rideId, refetch],
  );

  return { messages, status, loading, sending, send };
}
