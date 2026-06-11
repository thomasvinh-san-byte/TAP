import 'server-only';
import type { RideMessage, SenderRole } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

/**
 * Charge le fil de messages d'une course, trié chronologiquement (Phase
 * 06.41, DEC-120). La RLS `internal_message_select` cloisonne :
 *   - régulateur/dirigeant : toute conversation de leur organisation ;
 *   - chauffeur : uniquement ses propres courses.
 * Le client serveur transporte la session du profil connecté.
 *
 * `'server-only'` : jamais bundlé côté client. Le hook client passe par la
 * Server Action `getRideMessagesAction` qui appelle cette fonction.
 */
export async function getRideMessages(rideId: string): Promise<RideMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('internal_message')
    .select('id, ride_id, sender_profile_id, sender_role, body, created_at')
    .eq('ride_id', rideId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[ride-messages] read error', { message: error.message, code: error.code });
    return [];
  }

  return ((data ?? []) as RawMessage[]).map((m) => ({
    id: m.id,
    ride_id: m.ride_id,
    sender_profile_id: m.sender_profile_id,
    sender_role: m.sender_role,
    body: m.body,
    created_at: m.created_at,
  }));
}

interface RawMessage {
  id: string;
  ride_id: string;
  sender_profile_id: string;
  sender_role: SenderRole;
  body: string;
  created_at: string;
}
