'use server';

/**
 * Server Action override tarif course (Phase 04.7 PLAN-1 T1.3, DEC-029 esprit).
 *
 * Pattern :
 *   - Validation zod
 *   - requireAdminOrRegulateur (defense in depth — UI cache déjà le bouton)
 *   - Lecture tarif actuel (audit metadata)
 *   - UPDATE rides avec pattern DEC-041 row count check
 *   - INSERT audit_logs explicite action='ride.tarif.override'
 *
 * Refs : DEC-029 esprit, DEC-041 LOCKED, UI-SPEC Surface B.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { createClient } from '@/lib/supabase/server';

export type OverrideTarifState = { success?: true; error?: string };

const overrideSchema = z.object({
  rideId: z.string().uuid(),
  newTarifEur: z.number().positive().max(999.99),
  reason: z.string().trim().min(10).max(500),
});

export async function overrideRideTarifAction(
  input: z.infer<typeof overrideSchema>,
): Promise<OverrideTarifState> {
  const parsed = overrideSchema.safeParse(input);
  if (!parsed.success) return { error: 'Saisie invalide.' };

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Action réservée au régulateur ou dirigeant.' };

  const supabase = await createClient();

  // 1. Lire l'ancien tarif pour l'audit metadata
  const beforeRes = await supabase
    .from('rides')
    .select('tarif_amount_eur, tarif_source, organization_id')
    .eq('id', parsed.data.rideId)
    .single();
  const beforeRow = beforeRes.data as {
    tarif_amount_eur: number | null;
    tarif_source: string | null;
    organization_id: string;
  } | null;
  if (beforeRes.error || !beforeRow) return { error: 'Course introuvable.' };

  // 2. UPDATE avec pattern DEC-041 row count check
  const updated = await supabase
    .from('rides')
    .update({
      tarif_amount_eur: parsed.data.newTarifEur,
      tarif_source: 'override',
      updated_by: ctx.userId,
    } as never)
    .eq('id', parsed.data.rideId)
    .select('id');
  if (updated.error) return { error: 'Modification impossible.' };
  if (!updated.data || updated.data.length === 0) {
    return { error: 'Modification refusée — droits insuffisants.' };
  }

  // 3. INSERT audit_logs explicite ride.tarif.override
  await supabase.from('audit_logs').insert({
    organization_id: beforeRow.organization_id,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'ride.tarif.override',
    entity_type: 'ride',
    entity_id: parsed.data.rideId,
    metadata: {
      old_amount: beforeRow.tarif_amount_eur,
      old_source: beforeRow.tarif_source,
      new_amount: parsed.data.newTarifEur,
      reason: parsed.data.reason,
    },
  } as never);

  revalidatePath('/courses');
  return { success: true };
}
