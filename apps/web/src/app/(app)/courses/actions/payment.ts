'use server';

/**
 * Server Action de paiement d'une course — Phase 3 Passe 1, 03-B.
 *
 * Pattern (CLAUDE.md § 10) : zod → getAuthContext (rôle applicatif) →
 * UPDATE → revalidatePath. RLS Postgres double-checke (defense in depth).
 *
 * Cohérence métier zod (defense in depth vs check Postgres
 * rides_payment_encaisse_complet) : `encaisse` ⇒ `payment_method` requis.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAuthContext as getAuthContextWithRole } from '@/lib/auth/get-auth-context';
import { REGULATEUR_OR_DIRIGEANT, type ActionState } from './_shared';

const paymentMethodSchema = z.enum(['cash', 'cb', 'cheque', 'cgss_differe']);
const paymentStatusSchema = z.enum(['non_concerne', 'a_encaisser', 'encaisse']);
const tarifSourceSchema = z.enum(['manuel', 'cgss_auto', 'override', 'b2b_auto']);

const updateRidePaymentInputSchema = z
  .object({
    rideId: z.string().uuid(),
    tarif_amount_eur: z.number().nonnegative().optional(),
    tarif_source: tarifSourceSchema.optional(),
    payment_status: paymentStatusSchema,
    payment_method: paymentMethodSchema.optional(),
  })
  .refine((v) => v.payment_status !== 'encaisse' || !!v.payment_method, {
    message:
      'Une course encaissée doit indiquer le moyen de paiement (espèces, CB, chèque ou CGSS différé).',
    path: ['payment_method'],
  });

export async function updateRidePaymentAction(
  args: z.infer<typeof updateRidePaymentInputSchema>,
): Promise<ActionState> {
  const parsed = updateRidePaymentInputSchema.safeParse(args);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Paiement invalide.' };
  }

  const ctx = await getAuthContextWithRole();
  if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
  if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role as 'regulateur' | 'dirigeant')) {
    return { error: 'Seul un régulateur ou un dirigeant peut modifier un paiement.' };
  }

  // Pas de transition de statut ride ici — on ne touche qu'aux champs paiement.
  // payment_received_at posé à now() UNIQUEMENT à la bascule vers `encaisse`
  // (sinon laissé tel quel : éviter d'écraser la date d'origine d'encaissement).
  const update: Record<string, unknown> = {
    payment_status: parsed.data.payment_status,
    updated_by: ctx.userId,
  };
  if (parsed.data.tarif_amount_eur !== undefined) {
    update.tarif_amount_eur = parsed.data.tarif_amount_eur;
  }
  if (parsed.data.tarif_source !== undefined) {
    update.tarif_source = parsed.data.tarif_source;
  }
  if (parsed.data.payment_method !== undefined) {
    update.payment_method = parsed.data.payment_method;
  }
  if (parsed.data.payment_status === 'encaisse') {
    update.payment_received_at = new Date().toISOString();
  }

  // DEC-041 row count check.
  const upd = await ctx.supabase
    .from('rides')
    .update(update as never)
    .eq('id', parsed.data.rideId)
    .select('id');
  if (upd.error) return { error: 'Mise à jour paiement impossible.' };
  if (!upd.data || upd.data.length === 0) {
    return { error: 'Mise à jour refusée : droits insuffisants ou course absente.' };
  }

  revalidatePath('/courses');
  return { success: true, id: parsed.data.rideId };
}
