'use server';

/**
 * Server Action d'annulation d'une course (Phase 3 / clôture-bis Passe 1).
 *
 * Pattern miroir de `edit.ts` (CLAUDE.md § 10) : Validation zod → Authz
 * (RLS Postgres + whitelist rôle applicative) → UPDATE filtré par statut →
 * Audit log (trigger rides_audit_trigger) → revalidatePath.
 *
 * Règle métier :
 *   - Whitelist statut autorisé : { 'validee', 'assignee' }. Une course
 *     en_cours / terminee / déjà annulee ne peut PAS être annulée — l'UI
 *     masque le bouton mais le serveur refuse aussi (idempotence + audit
 *     trail propre).
 *   - Whitelist rôle : régulateur + dirigeant.
 *   - Le motif est libre, optionnel, ≤ 500 chars (col `cancel_motif` posée
 *     dans la migration `20260514000001_rides_cancel_motif.sql`).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import type { ActionState } from './_shared';
import { REGULATEUR_OR_DIRIGEANT } from './_shared';

const cancelRideInputSchema = z.object({
  rideId: z.string().uuid(),
  motif: z.string().trim().max(500).optional(),
});

export async function cancelRideAction(
  args: z.infer<typeof cancelRideInputSchema>,
): Promise<ActionState> {
  const parsed = cancelRideInputSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }

  const ctx = await getAuthContext();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role as never)) {
    return { error: 'Action réservée au régulateur.' };
  }

  const { error, data } = await ctx.supabase
    .from('rides')
    .update({
      status: 'annulee_regulateur',
      cancel_motif: parsed.data.motif?.trim() || null,
      updated_by: ctx.userId,
    } as never)
    .eq('id', parsed.data.rideId)
    .in('status', ['validee', 'assignee'])
    .select('id')
    .maybeSingle();

  if (error) return { error: 'Annulation impossible.' };
  if (!data) {
    return {
      error:
        'Course non annulable : elle a été démarrée, terminée ou déjà annulée.',
    };
  }

  revalidatePath('/courses');
  return { success: true, id: parsed.data.rideId };
}
