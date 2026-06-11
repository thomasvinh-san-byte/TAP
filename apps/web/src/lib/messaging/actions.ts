'use server';

/**
 * Server Actions — messagerie interne lot 1 (Phase 06.41, DEC-120).
 *
 * Pattern (CLAUDE.md § 10) : guard auth → zod safeParse → INSERT. La RLS
 * Postgres (`internal_message_insert`) reste l'autorité (defense in depth) :
 * elle impose org, `sender_profile_id = auth.uid()`, `sender_role` cohérent,
 * et qu'un chauffeur n'écrive que sur SES courses. L'INSERT renvoie la ligne
 * créée — une absence de ligne = rejet RLS silencieux remonté en erreur
 * explicite (esprit DEC-041, sans message technique brut).
 *
 * Le Realtime propage la nouvelle ligne aux abonnés ; on ne `revalidatePath`
 * pas (le fil est temps réel côté client).
 */

import { z } from 'zod';
import type { RideMessage } from '@tap/shared';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { getRideMessages } from './get-ride-messages';

export type SendMessageState = { success?: boolean; error?: string };

const sendSchema = z.object({
  rideId: z.string().uuid(),
  body: z.string().trim().min(1, 'Message vide.').max(2000, 'Message trop long (2000 max).'),
});

/**
 * Liste les messages d'une course (wrapper Server Action de la query
 * `'server-only'`). Permet au hook client le fetch initial + le refetch au
 * resubscribe Realtime. La RLS fait le cloisonnement.
 */
export async function getRideMessagesAction(
  rideId: string,
): Promise<{ messages: RideMessage[]; error?: string }> {
  if (!z.string().uuid().safeParse(rideId).success) {
    return { messages: [], error: 'Course invalide.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { messages: [], error: 'Session expirée. Reconnectez-vous.' };

  const messages = await getRideMessages(rideId);
  return { messages };
}

/**
 * Envoie un message sur une course. Tout membre de l'organisation peut écrire
 * (régulateur, dirigeant, chauffeur) ; la RLS restreint le chauffeur à ses
 * propres courses et empêche l'usurpation d'auteur/rôle.
 */
export async function sendRideMessageAction(
  rideId: string,
  body: string,
): Promise<SendMessageState> {
  const parsed = sendSchema.safeParse({ rideId, body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Message invalide.' };
  }

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };

  const { data, error } = await ctx.supabase
    .from('internal_message')
    .insert({
      organization_id: ctx.organizationId,
      ride_id: parsed.data.rideId,
      sender_profile_id: ctx.userId,
      sender_role: ctx.role,
      body: parsed.data.body,
    } as never)
    .select('id');

  if (error) return { error: 'Envoi impossible. Vérifiez que la course vous est accessible.' };
  if (!data || (data as { id: string }[]).length === 0) {
    return { error: 'Envoi refusé : course non accessible.' };
  }
  return { success: true };
}
