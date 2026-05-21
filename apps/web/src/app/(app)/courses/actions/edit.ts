'use server';

/**
 * Server Action de modification d'une course existante (Phase 3 / clôture
 * Passe 1).
 *
 * Pattern (CLAUDE.md § 10) : Validation zod → Authz (RLS Postgres +
 * whitelist rôle applicative defense in depth) → UPDATE filtré par statut →
 * Audit log (trigger Postgres rides_audit_trigger) → revalidatePath.
 *
 * Règle métier : une course ne peut être modifiée que tant qu'elle n'est
 * pas démarrée par le chauffeur (`status ∈ {validee, assignee}`). Au-delà
 * (en_cours / terminee / annulee_*), toute édition est refusée — l'UI
 * masque déjà le bouton « Modifier » mais on garde le garde-fou serveur.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { rideExpressInputSchema } from '@tap/shared';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import type { ActionState } from './_shared';
import { REGULATEUR_OR_DIRIGEANT } from './_shared';

const updateRideInputSchema = z.object({
  rideId: z.string().uuid(),
  input: rideExpressInputSchema,
});

export async function updateRideAction(
  args: z.infer<typeof updateRideInputSchema>,
): Promise<ActionState> {
  const parsed = updateRideInputSchema.safeParse(args);
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
      ...parsed.data.input,
      updated_by: ctx.userId,
    } as never)
    .eq('id', parsed.data.rideId)
    .in('status', ['validee', 'assignee'])
    .select('id')
    .maybeSingle();

  if (error) return { error: 'Modification impossible.' };
  if (!data) {
    return {
      error: 'Course non modifiable : elle a été démarrée, terminée ou annulée.',
    };
  }

  revalidatePath('/courses');
  return { success: true, id: parsed.data.rideId };
}
