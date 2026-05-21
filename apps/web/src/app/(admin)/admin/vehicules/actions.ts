'use server';

/**
 * Server Actions admin véhicules (clôture-bis Passe 1).
 *
 * Pattern miroir de `chauffeurs/actions.ts`. Le check unique partiel
 * `vehicles_immatriculation_unique` côté DB renvoie une erreur Postgres
 * en cas de doublon ; on la reformule en français lisible.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { vehicleInputSchema } from '@tap/shared';
import { getAuthContext } from '@/lib/auth/get-auth-context';

export type ActionState = {
  success?: boolean;
  id?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
};

async function requireDirigeant() {
  const ctx = await getAuthContext();
  if (!ctx) return null;
  if (ctx.role !== 'dirigeant') return null;
  return ctx;
}

function parseFormData(formData: FormData) {
  const placesAssises = formData.get('places_assises');
  const placesTpmr = formData.get('places_tpmr');
  return vehicleInputSchema.safeParse({
    immatriculation: formData.get('immatriculation'),
    marque: formData.get('marque'),
    modele: formData.get('modele'),
    type: formData.get('type'),
    places_assises:
      placesAssises === null || placesAssises === '' ? undefined : Number(placesAssises),
    places_tpmr: placesTpmr === null || placesTpmr === '' ? undefined : Number(placesTpmr),
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
    .from('vehicles' as never)
    .insert({
      ...parsed.data,
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
      marque: parsed.data.marque || null,
      modele: parsed.data.modele || null,
    } as never)
    .select('id')
    .single();

  if (error || !data) {
    return { error: reformulateInsertError(error?.message ?? '') };
  }
  revalidatePath('/admin/vehicules');
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
    .from('vehicles' as never)
    .update({
      ...parsed.data,
      marque: parsed.data.marque || null,
      modele: parsed.data.modele || null,
    } as never)
    .eq('id', vehicleId)
    .eq('archive', false)
    .select('id')
    .maybeSingle();

  if (error) return { error: reformulateInsertError(error.message) };
  if (!data) return { error: 'Véhicule introuvable ou archivé.' };

  revalidatePath('/admin/vehicules');
  return { success: true, id: vehicleId };
}

export async function archiveVehicleAction(vehicleId: string): Promise<ActionState> {
  if (!z.string().uuid().safeParse(vehicleId).success) {
    return { error: 'Identifiant véhicule invalide.' };
  }

  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Accès dirigeant requis.' };

  const { error } = await ctx.supabase
    .from('vehicles' as never)
    .update({
      archive: true,
      archive_at: new Date().toISOString(),
      actif: false,
    } as never)
    .eq('id', vehicleId);

  if (error) return { error: 'Archivage impossible.' };
  revalidatePath('/admin/vehicules');
  return { success: true };
}
