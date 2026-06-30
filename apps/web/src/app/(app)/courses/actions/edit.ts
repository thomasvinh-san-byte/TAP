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
import { rideExpressInputSchema, RIDE_MODIFIABLE_STATUSES } from '@tap/shared';
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

  // RECURRENCE-02 (§5.9) — surcharge d'occurrence (override standard iCalendar).
  // Si cette course appartient à une série et que la modification CHANGE SA DATE,
  // on exclut la date d'origine (EXDATE) AVANT l'édition, pour que le cron de
  // génération ne régénère jamais l'occurrence d'origine (sinon doublon). Si la
  // date ne change pas (heure dans la journée / lieu seulement), aucune exclusion
  // (le cron protège déjà par date). L'instance modifiée reste la course éditée
  // (elle garde son ride_recurrence_id).
  const currentRes = await ctx.supabase
    .from('rides')
    .select('ride_recurrence_id, scheduled_at')
    .eq('id', parsed.data.rideId)
    .maybeSingle();
  const current = currentRes.data as {
    ride_recurrence_id: string | null;
    scheduled_at: string;
  } | null;

  if (current?.ride_recurrence_id) {
    const origDate = current.scheduled_at.slice(0, 10);
    const newDate = new Date(parsed.data.input.scheduled_at).toISOString().slice(0, 10);
    if (origDate !== newDate) {
      // Exclusion de la date d'origine (idempotente : unique recurrence+date).
      const excRes = await ctx.supabase.from('ride_recurrence_exceptions').upsert(
        {
          ride_recurrence_id: current.ride_recurrence_id,
          excluded_date: origDate,
          reason: 'occurrence_deplacee',
          replaced_by_ride_id: parsed.data.rideId,
          created_by: ctx.userId,
        } as never,
        { onConflict: 'ride_recurrence_id,excluded_date' },
      );
      if (excRes.error) {
        return { error: 'Déplacement impossible (exclusion de la date d’origine refusée).' };
      }
    }
  }

  const { error, data } = await ctx.supabase
    .from('rides')
    .update({
      ...parsed.data.input,
      updated_by: ctx.userId,
    } as never)
    .eq('id', parsed.data.rideId)
    // DEC-178 : statuts modifiables avant démarrage (machine à états centralisée).
    .in('status', [...RIDE_MODIFIABLE_STATUSES])
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
