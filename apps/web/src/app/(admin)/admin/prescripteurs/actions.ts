'use server';

/**
 *
 * Pattern miroir de `donneurs-ordres/actions.ts` : validation zod →
 * requireAdminOrRegulateur (dirigeant OU régulateur) → INSERT/UPDATE filtré →
 * revalidatePath + revalidateTag (data-cache par org). L'audit est alimenté par
 * le trigger Postgres `prescribers_audit_trigger`. RLS double-checke.
 *
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { prescriberInputSchema } from '@tap/shared';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { prescribersTag } from './_lib/cached-queries';

export type ActionState = {
  success?: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseFormData(formData: FormData) {
  return prescriberInputSchema.safeParse({
    nom: formData.get('nom'),
    prenom: formData.get('prenom'),
    type: formData.get('type'),
    rpps: formData.get('rpps'),
    adeli: formData.get('adeli'),
    finess: formData.get('finess'),
    specialite: formData.get('specialite'),
    contact_telephone: formData.get('contact_telephone'),
    contact_email: formData.get('contact_email'),
    adresse: formData.get('adresse'),
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

function toRow(data: z.infer<typeof prescriberInputSchema>) {
  return {
    nom: data.nom,
    prenom: nullifyEmpty(data.prenom),
    type: data.type,
    rpps: nullifyEmpty(data.rpps),
    adeli: nullifyEmpty(data.adeli),
    finess: nullifyEmpty(data.finess),
    specialite: nullifyEmpty(data.specialite),
    contact_telephone: nullifyEmpty(data.contact_telephone),
    contact_email: nullifyEmpty(data.contact_email),
    adresse: nullifyEmpty(data.adresse),
    actif: data.actif,
  };
}

export async function createPrescriberAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès dirigeant ou régulateur requis.' };

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { error: 'Vérifiez les champs.', fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const { data, error } = await ctx.supabase
    .from('prescribers')
    .insert({
      ...toRow(parsed.data),
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { error: 'Création du prescripteur impossible.' };
  }
  revalidatePath('/admin/prescripteurs');
  revalidateTag(prescribersTag(ctx.organizationId));
  return { success: true, id: (data as { id: string }).id };
}

export async function updatePrescriberAction(
  prescriberId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!z.string().uuid().safeParse(prescriberId).success) {
    return { error: 'Identifiant prescripteur invalide.' };
  }

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès dirigeant ou régulateur requis.' };

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return { error: 'Vérifiez les champs.', fieldErrors: flattenFieldErrors(parsed.error) };
  }

  const { error, data } = await ctx.supabase
    .from('prescribers')
    .update(toRow(parsed.data))
    .eq('id', prescriberId)
    .eq('archive', false)
    .select('id')
    .maybeSingle();

  if (error) return { error: 'Modification impossible.' };
  if (!data) return { error: 'Prescripteur introuvable ou archivé.' };

  revalidatePath('/admin/prescripteurs');
  revalidateTag(prescribersTag(ctx.organizationId));
  return { success: true, id: prescriberId };
}

export async function archivePrescriberAction(prescriberId: string): Promise<ActionState> {
  if (!z.string().uuid().safeParse(prescriberId).success) {
    return { error: 'Identifiant prescripteur invalide.' };
  }

  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return { error: 'Accès dirigeant ou régulateur requis.' };

  const { error, data } = await ctx.supabase
    .from('prescribers')
    .update({
      archive: true,
      archive_at: new Date().toISOString(),
      actif: false,
    })
    .eq('id', prescriberId)
    .select('id');

  if (error) return { error: 'Archivage impossible.' };
  // DEC-041 — row count check : RLS rejette en silence un UPDATE hors droits.
  if (!data || (data as unknown[]).length === 0) {
    return { error: 'Prescripteur introuvable : droits insuffisants.' };
  }
  revalidatePath('/admin/prescripteurs');
  revalidateTag(prescribersTag(ctx.organizationId));
  return { success: true };
}
