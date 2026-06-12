'use server';

/**
 * Server Actions — abonnement Web Push (PWA, DEC-167).
 *
 * L'utilisateur gère SES propres abonnements (RLS user-scoped). Insert/upsert
 * via le client RLS (user_id = auth.uid()). Plusieurs appareils possibles
 * (1 abonnement par endpoint). Désabonnement = suppression de l'endpoint.
 */

import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/get-auth-context';

export type PushActionState = { success?: boolean; error?: string };

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(400).optional(),
});

export async function savePushSubscriptionAction(
  args: z.infer<typeof subscriptionSchema>,
): Promise<PushActionState> {
  const parsed = subscriptionSchema.safeParse(args);
  if (!parsed.success) return { error: 'Abonnement invalide.' };
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };

  const { error } = await ctx.supabase.from('push_subscriptions' as never).upsert(
    {
      organization_id: ctx.organizationId,
      user_id: ctx.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent ?? null,
      last_used_at: new Date().toISOString(),
    } as never,
    { onConflict: 'endpoint' },
  );
  if (error) return { error: "Enregistrement de l'abonnement impossible." };
  return { success: true };
}

export async function deletePushSubscriptionAction(endpoint: string): Promise<PushActionState> {
  if (!z.string().url().safeParse(endpoint).success) {
    return { error: 'Endpoint invalide.' };
  }
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };

  // RLS : ne supprime que SES propres abonnements (user_id = auth.uid()).
  const { error } = await ctx.supabase
    .from('push_subscriptions' as never)
    .delete()
    .eq('endpoint' as never, endpoint as never);
  if (error) return { error: 'Désabonnement impossible.' };
  return { success: true };
}
