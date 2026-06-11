'use server';

/**
 * Server Actions admin donneurs d'ordres B2B (CdC §5.5, DEC-148).
 *
 * Pattern miroir de `vehicules/actions.ts` : validation zod → requireDirigeant
 * → INSERT/UPDATE filtré → revalidatePath. L'audit est alimenté par le
 * trigger Postgres `ordering_parties_audit_trigger`. RLS dirigeant-only en
 * écriture (defense in depth avec `requireDirigeant`).
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { orderingPartyInputSchema, orderingPartyTariffGridSchema } from '@tap/shared';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import { donneursOrdresTag } from './_lib/cached-queries';

export type ActionState = {
  success?: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseFormData(formData: FormData) {
  return orderingPartyInputSchema.safeParse({
    raison_sociale: formData.get('raison_sociale'),
    siret: formData.get('siret'),
    contact_principal_nom: formData.get('contact_principal_nom'),
    contact_principal_telephone: formData.get('contact_principal_telephone'),
    contact_principal_email: formData.get('contact_principal_email'),
    modalite_facturation: formData.get('modalite_facturation'),
    tariff_mode: formData.get('tariff_mode'),
    actif: formData.get('actif') === 'on',
  });
}

function flattenFieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(err.flatten().fieldErrors)) {
    if (v && v[0]) out[k] = v[0];
  }
  return out;
}

/** Vide → null pour les colonnes optionnelles (cohérence avec la BDD). */
function nullifyEmpty(value: string | undefined): string | null {
  return value && value.length > 0 ? value : null;
}

function toRow(data: z.infer<typeof orderingPartyInputSchema>) {
  return {
    raison_sociale: data.raison_sociale,
    siret: nullifyEmpty(data.siret),
    contact_principal_nom: nullifyEmpty(data.contact_principal_nom),
    contact_principal_telephone: nullifyEmpty(data.contact_principal_telephone),
    contact_principal_email: nullifyEmpty(data.contact_principal_email),
    modalite_facturation: data.modalite_facturation,
    tariff_mode: data.tariff_mode,
    actif: data.actif,
  };
}

export async function createOrderingPartyAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Accès dirigeant requis.' };

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { error: 'Vérifiez les champs.', fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const { data, error } = await ctx.supabase
    .from('ordering_parties')
    .insert({
      ...toRow(parsed.data),
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
    } as never)
    .select('id')
    .single();

  if (error || !data) {
    return { error: "Création du donneur d'ordres impossible." };
  }
  revalidatePath('/admin/donneurs-ordres');
  // DEC-153 : purge le cache data par org (la liste reflète l'écriture aussitôt).
  revalidateTag(donneursOrdresTag(ctx.organizationId));
  return { success: true, id: (data as { id: string }).id };
}

export async function updateOrderingPartyAction(
  partyId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!z.string().uuid().safeParse(partyId).success) {
    return { error: "Identifiant donneur d'ordres invalide." };
  }

  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Accès dirigeant requis.' };

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { error: 'Vérifiez les champs.', fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const { error, data } = await ctx.supabase
    .from('ordering_parties')
    .update(toRow(parsed.data) as never)
    .eq('id', partyId)
    .eq('archive', false)
    .select('id')
    .maybeSingle();

  if (error) return { error: 'Modification impossible.' };
  if (!data) return { error: "Donneur d'ordres introuvable ou archivé." };

  revalidatePath('/admin/donneurs-ordres');
  // DEC-153 : purge le cache data par org (la liste reflète l'écriture aussitôt).
  revalidateTag(donneursOrdresTag(ctx.organizationId));
  return { success: true, id: partyId };
}

export async function archiveOrderingPartyAction(partyId: string): Promise<ActionState> {
  if (!z.string().uuid().safeParse(partyId).success) {
    return { error: "Identifiant donneur d'ordres invalide." };
  }

  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Accès dirigeant requis.' };

  const { error, data } = await ctx.supabase
    .from('ordering_parties')
    .update({
      archive: true,
      archive_at: new Date().toISOString(),
      actif: false,
    } as never)
    .eq('id', partyId)
    .select('id');

  if (error) return { error: 'Archivage impossible.' };
  // DEC-041 — row count check : RLS rejette en silence un UPDATE hors droits.
  if (!data || (data as unknown[]).length === 0) {
    return { error: "Donneur d'ordres introuvable : droits insuffisants." };
  }
  revalidatePath('/admin/donneurs-ordres');
  // DEC-153 : purge le cache data par org (la liste reflète l'écriture aussitôt).
  revalidateTag(donneursOrdresTag(ctx.organizationId));
  return { success: true };
}

// --------------------------------------------------------------------------
// GRILLE TARIFAIRE B2B (DEC-157) — versionnée par donneur d'ordres
// --------------------------------------------------------------------------

export type TariffGridActionState = { success?: true; error?: string };

/**
 * Enregistre une nouvelle version de grille tarifaire propre pour un donneur
 * d'ordres (versionnement strict, comme tariff_grids : INSERT, jamais UPDATE).
 * Dirigeant uniquement (RLS + requireDirigeant). N'a de sens que pour un donneur
 * en `tariff_mode = 'grille_propre'`.
 */
export async function saveOrderingPartyTariffGridAction(
  partyId: string,
  formData: FormData,
): Promise<TariffGridActionState> {
  if (!z.string().uuid().safeParse(partyId).success) {
    return { error: "Identifiant donneur d'ordres invalide." };
  }
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Action réservée au dirigeant.' };

  const parsed = orderingPartyTariffGridSchema.safeParse({
    date_effet: formData.get('date_effet'),
    forfait_eur: formData.get('forfait_eur'),
    km_inclus: formData.get('km_inclus'),
    prix_km_eur: formData.get('prix_km_eur'),
    supplement_drom_eur: formData.get('supplement_drom_eur'),
    supplement_tpmr_eur: formData.get('supplement_tpmr_eur'),
    majoration_pct: formData.get('majoration_pct'),
    facteur_correction_routier: formData.get('facteur_correction_routier'),
    arrondi_eur: formData.get('arrondi_eur'),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Grille invalide.' };
  }

  const { error } = await ctx.supabase.from('ordering_party_tariff_grids' as never).insert({
    ...parsed.data,
    organization_id: ctx.organizationId,
    ordering_party_id: partyId,
    created_by: ctx.userId,
  } as never);

  if (error) {
    // Contrainte unique (ordering_party_id, date_effet) → message clair.
    if (error.message.includes('ordering_party_tariff_grids')) {
      return { error: 'Une grille existe déjà pour cette date d’effet.' };
    }
    return { error: 'Enregistrement de la grille impossible.' };
  }
  revalidatePath('/admin/donneurs-ordres');
  return { success: true };
}

export type OrderingPartyTariffGridRow = {
  date_effet: string;
  forfait_eur: number;
  km_inclus: number;
  prix_km_eur: number;
  supplement_drom_eur: number;
  supplement_tpmr_eur: number;
  majoration_pct: number;
  facteur_correction_routier: number;
  arrondi_eur: number;
};

/** Grille B2B active (≤ aujourd'hui) d'un donneur d'ordres, ou null. */
export async function getOrderingPartyActiveTariffGridAction(
  partyId: string,
): Promise<OrderingPartyTariffGridRow | null> {
  if (!z.string().uuid().safeParse(partyId).success) return null;
  const ctx = await requireDirigeant();
  if (!ctx) return null;
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await ctx.supabase
    .from('ordering_party_tariff_grids' as never)
    .select(
      'date_effet, forfait_eur, km_inclus, prix_km_eur, supplement_drom_eur, ' +
        'supplement_tpmr_eur, majoration_pct, facteur_correction_routier, arrondi_eur',
    )
    .eq('ordering_party_id', partyId)
    .lte('date_effet', today)
    .order('date_effet', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as OrderingPartyTariffGridRow | null) ?? null;
}
