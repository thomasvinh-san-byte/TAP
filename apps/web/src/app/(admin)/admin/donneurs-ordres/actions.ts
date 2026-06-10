'use server';

/**
 * Server Actions admin donneurs d'ordres B2B (CdC §5.5, DEC-148).
 *
 * Pattern miroir de `vehicules/actions.ts` : validation zod → requireDirigeant
 * → INSERT/UPDATE filtré → revalidatePath. L'audit est alimenté par le
 * trigger Postgres `ordering_parties_audit_trigger`. RLS dirigeant-only en
 * écriture (defense in depth avec `requireDirigeant`).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { orderingPartyInputSchema } from '@tap/shared';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';

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
    .from('ordering_parties' as never)
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
    .from('ordering_parties' as never)
    .update(toRow(parsed.data) as never)
    .eq('id', partyId)
    .eq('archive', false)
    .select('id')
    .maybeSingle();

  if (error) return { error: 'Modification impossible.' };
  if (!data) return { error: "Donneur d'ordres introuvable ou archivé." };

  revalidatePath('/admin/donneurs-ordres');
  return { success: true, id: partyId };
}

export async function archiveOrderingPartyAction(partyId: string): Promise<ActionState> {
  if (!z.string().uuid().safeParse(partyId).success) {
    return { error: "Identifiant donneur d'ordres invalide." };
  }

  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Accès dirigeant requis.' };

  const { error, data } = await ctx.supabase
    .from('ordering_parties' as never)
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
  return { success: true };
}
