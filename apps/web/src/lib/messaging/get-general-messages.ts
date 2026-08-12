import 'server-only';
import type { GeneralMessage, SenderRole } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

/**
 * Charge le fil général de l'organisation, trié chronologiquement (§5.22 lot A).
 * La RLS `internal_general_message_select` cloisonne par organisation (tout
 * membre de l'org voit le fil commun). Le client serveur transporte la session.
 *
 * `'server-only'` : jamais bundlé côté client. Le hook passe par la Server
 * Action `getGeneralMessagesAction`.
 */
export async function getGeneralMessages(): Promise<GeneralMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('internal_general_message')
    .select('id, sender_profile_id, sender_role, body, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[general-messages] read error', { message: error.message, code: error.code });
    return [];
  }

  return ((data ?? []) as RawGeneralMessage[]).map((m) => ({
    id: m.id,
    sender_profile_id: m.sender_profile_id,
    sender_role: m.sender_role,
    body: m.body,
    created_at: m.created_at,
  }));
}

interface RawGeneralMessage {
  id: string;
  sender_profile_id: string;
  sender_role: SenderRole;
  body: string;
  created_at: string;
}
