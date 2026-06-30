'use server';

/**
 * Server Actions admin véhicules (clôture-bis Passe 1).
 *
 * Pattern miroir de `chauffeurs/actions.ts`. Le check unique partiel
 * `vehicles_immatriculation_unique` côté DB renvoie une erreur Postgres
 * en cas de doublon ; on la reformule en français lisible.
 */

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { vehicleInputSchema } from '@tap/shared';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';
import { normalizeBrandOrModel } from '@/lib/vehicles/catalog';
import { vehiculesTag } from './_lib/cached-queries';

export type ActionState = {
  success?: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseFormData(formData: FormData) {
  const placesAssises = formData.get('places_assises');
  const placesTpmr = formData.get('places_tpmr');
  const rawMarque = formData.get('marque');
  const rawModele = formData.get('modele');
  const capaciteCharge = formData.get('capacite_charge_kg');
  return vehicleInputSchema.safeParse({
    immatriculation: formData.get('immatriculation'),
    // D-07 : normalisation Title Case sur saisies libres (limite les
    // doublons d'orthographe sans bloquer la saisie). Les valeurs déjà
    // choisies dans la combobox passent inchangées.
    marque: typeof rawMarque === 'string' ? normalizeBrandOrModel(rawMarque) : rawMarque,
    modele: typeof rawModele === 'string' ? normalizeBrandOrModel(rawModele) : rawModele,
    type: formData.get('type'),
    places_assises:
      placesAssises === null || placesAssises === '' ? undefined : Number(placesAssises),
    places_tpmr: placesTpmr === null || placesTpmr === '' ? undefined : Number(placesTpmr),
    // VEHICULE-01 (§5.7) : équipements de compatibilité.
    equipement_oxygene: formData.get('equipement_oxygene') === 'on',
    equipement_brancard: formData.get('equipement_brancard') === 'on',
    capacite_charge_kg:
      capaciteCharge === null || capaciteCharge === '' ? undefined : Number(capaciteCharge),
    equipement_autre: formData.get('equipement_autre') ?? undefined,
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

function reformulateInsertError(message: string): string {
  if (message.toLowerCase().includes('vehicles_immatriculation_unique')) {
    return 'Cette immatriculation existe déjà.';
  }
  return 'Création véhicule impossible.';
}

export async function createVehicleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Accès dirigeant requis.' };

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return {
      error: 'Vérifiez les champs.',
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { data, error } = await ctx.supabase
    .from('vehicles')
    .insert({
      ...parsed.data,
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
      marque: parsed.data.marque || null,
      modele: parsed.data.modele || null,
      equipement_autre: parsed.data.equipement_autre || null,
    } as never)
    .select('id')
    .single();

  if (error || !data) {
    return { error: reformulateInsertError(error?.message ?? '') };
  }
  revalidatePath('/admin/vehicules');
  // DEC-153 : purge le cache data par org (la liste reflète l'écriture aussitôt).
  revalidateTag(vehiculesTag(ctx.organizationId));
  return { success: true, id: (data as { id: string }).id };
}

export async function updateVehicleAction(
  vehicleId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!z.string().uuid().safeParse(vehicleId).success) {
    return { error: 'Identifiant véhicule invalide.' };
  }

  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Accès dirigeant requis.' };

  const parsed = parseFormData(formData);
  if (!parsed.success) {
    return {
      error: 'Vérifiez les champs.',
      fieldErrors: flattenFieldErrors(parsed.error),
    };
  }

  const { error, data } = await ctx.supabase
    .from('vehicles')
    .update({
      ...parsed.data,
      marque: parsed.data.marque || null,
      modele: parsed.data.modele || null,
      equipement_autre: parsed.data.equipement_autre || null,
    } as never)
    .eq('id', vehicleId)
    .eq('archive', false)
    .select('id')
    .maybeSingle();

  if (error) return { error: reformulateInsertError(error.message) };
  if (!data) return { error: 'Véhicule introuvable ou archivé.' };

  revalidatePath('/admin/vehicules');
  // DEC-153 : purge le cache data par org (la liste reflète l'écriture aussitôt).
  revalidateTag(vehiculesTag(ctx.organizationId));
  return { success: true, id: vehicleId };
}

export async function archiveVehicleAction(vehicleId: string): Promise<ActionState> {
  if (!z.string().uuid().safeParse(vehicleId).success) {
    return { error: 'Identifiant véhicule invalide.' };
  }

  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Accès dirigeant requis.' };

  const { error, data } = await ctx.supabase
    .from('vehicles')
    .update({
      archive: true,
      archive_at: new Date().toISOString(),
      actif: false,
    } as never)
    .eq('id', vehicleId)
    .select('id');

  if (error) return { error: 'Archivage impossible.' };
  // DEC-041 — row count check : RLS rejette en silence un UPDATE hors droits.
  if (!data || (data as unknown[]).length === 0) {
    return { error: 'Véhicule introuvable : droits insuffisants.' };
  }
  revalidatePath('/admin/vehicules');
  // DEC-153 : purge le cache data par org (la liste reflète l'écriture aussitôt).
  revalidateTag(vehiculesTag(ctx.organizationId));
  return { success: true };
}
