'use server';

/**
 * Server Action /admin/tarifs (Phase 05.5 Wave 3).
 *
 * Édition d'une grille tarifaire = INSERT d'une nouvelle version
 * (DEC-057 — versionnement strict, jamais UPDATE). Pattern Zod +
 * requireDirigeant + DEC-041 row count check + audit_logs (PRIC-04).
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import { createClient } from '@/lib/supabase/server';
import { tarifsTag } from './_lib/cached-queries';

export type TariffGridActionState = {
  success?: true;
  error?: string;
};

const saveSchema = z.object({
  date_effet: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date d'effet invalide"),
  forfait_eur: z.coerce.number().min(0).max(999.99),
  km_inclus: z.coerce.number().int().min(0).max(99),
  prix_km_eur: z.coerce.number().min(0).max(99.99),
  supplement_drom_eur: z.coerce.number().min(0).max(999.99),
  supplement_tpmr_eur: z.coerce.number().min(0).max(999.99),
  supplement_accompagnant_eur: z.coerce.number().min(0).max(999.99),
  majoration_pct: z.coerce.number().int().min(0).max(100),
  facteur_correction_routier: z.coerce.number().min(1).max(9.99),
  arrondi_eur: z.coerce.number().min(0.01).max(1),
});

function pickFormData(formData: FormData, keys: string[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (value === null || value === '') continue;
    obj[key] = value;
  }
  return obj;
}

export async function saveTariffGridAction(formData: FormData): Promise<TariffGridActionState> {
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Action réservée au dirigeant.' };

  const parsed = saveSchema.safeParse(
    pickFormData(formData, [
      'date_effet',
      'forfait_eur',
      'km_inclus',
      'prix_km_eur',
      'supplement_drom_eur',
      'supplement_tpmr_eur',
      'supplement_accompagnant_eur',
      'majoration_pct',
      'facteur_correction_routier',
      'arrondi_eur',
    ]),
  );
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }

  const supabase = await createClient();
  const insertRes = await supabase
    .from('tariff_grids')
    .insert({
      organization_id: ctx.organizationId,
      date_effet: parsed.data.date_effet,
      forfait_eur: parsed.data.forfait_eur,
      km_inclus: parsed.data.km_inclus,
      prix_km_eur: parsed.data.prix_km_eur,
      supplement_drom_eur: parsed.data.supplement_drom_eur,
      supplement_tpmr_eur: parsed.data.supplement_tpmr_eur,
      supplement_accompagnant_eur: parsed.data.supplement_accompagnant_eur,
      majoration_pct: parsed.data.majoration_pct,
      facteur_correction_routier: parsed.data.facteur_correction_routier,
      arrondi_eur: parsed.data.arrondi_eur,
      created_by: ctx.userId,
    })
    .select('id');
  if (insertRes.error) {
    if (insertRes.error.code === '23505') {
      return { error: "Une grille existe déjà à cette date d'effet." };
    }
    return { error: 'Création de la grille refusée.' };
  }
  if (!insertRes.data || (insertRes.data as unknown[]).length === 0) {
    return { error: 'Création refusée : droits insuffisants.' };
  }

  await supabase.from('audit_logs').insert({
    organization_id: ctx.organizationId,
    actor_id: ctx.userId,
    actor_role: ctx.role,
    action: 'tariff_grid.create',
    entity_type: 'tariff_grid',
    entity_id: null,
    metadata: {
      date_effet: parsed.data.date_effet,
      prix_km_eur: parsed.data.prix_km_eur,
      forfait_eur: parsed.data.forfait_eur,
    },
  });

  revalidatePath('/admin/tarifs');
  // DEC-153 : purge le cache data par org (la grille reflète l'écriture aussitôt).
  revalidateTag(tarifsTag(ctx.organizationId));
  return { success: true };
}
