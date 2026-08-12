'use server';

/**
 * Server Action /admin/parametres-couts (§5.20 lot E).
 *
 * Enregistre les paramètres de coût de l'organisation (carburant + entretien +
 * amortissement en €/km) pour les KPIs de marge du dirigeant. Une ligne par
 * organisation : UPSERT sur `organization_id`. Pattern zod + requireDirigeant +
 * contrôle du nombre de lignes (DEC-041) + audit_logs (paramètre de coût).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import { createClient } from '@/lib/supabase/server';

export type CostParametersActionState = {
  success?: true;
  error?: string;
};

const saveSchema = z.object({
  cout_carburant_eur_km: z.coerce.number().min(0).max(99),
  cout_entretien_eur_km: z.coerce.number().min(0).max(99),
  cout_amortissement_eur_km: z.coerce.number().min(0).max(99),
});

export async function saveCostParametersAction(
  formData: FormData,
): Promise<CostParametersActionState> {
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Action réservée au dirigeant.' };

  const parsed = saveSchema.safeParse({
    cout_carburant_eur_km: formData.get('cout_carburant_eur_km'),
    cout_entretien_eur_km: formData.get('cout_entretien_eur_km'),
    cout_amortissement_eur_km: formData.get('cout_amortissement_eur_km'),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }

  const supabase = await createClient();
  const upsertRes = await supabase
    .from('cost_parameters')
    .upsert(
      {
        organization_id: ctx.organizationId,
        cout_carburant_eur_km: parsed.data.cout_carburant_eur_km,
        cout_entretien_eur_km: parsed.data.cout_entretien_eur_km,
        cout_amortissement_eur_km: parsed.data.cout_amortissement_eur_km,
        updated_at: new Date().toISOString(),
        updated_by: ctx.userId,
      },
      { onConflict: 'organization_id' },
    )
    .select('id');
  if (upsertRes.error) return { error: 'Enregistrement des paramètres refusé.' };
  if (!upsertRes.data || (upsertRes.data as unknown[]).length === 0) {
    return { error: 'Enregistrement refusé : droits insuffisants.' };
  }

  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'cost_parameters.update',
    entity_type: 'cost_parameters',
    entity_id: null,
    metadata: {
      cout_carburant_eur_km: parsed.data.cout_carburant_eur_km,
      cout_entretien_eur_km: parsed.data.cout_entretien_eur_km,
      cout_amortissement_eur_km: parsed.data.cout_amortissement_eur_km,
    },
  });

  revalidatePath('/admin/parametres-couts');
  revalidatePath('/tableau-de-bord');
  return { success: true };
}
