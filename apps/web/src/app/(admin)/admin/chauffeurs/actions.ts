'use server';

/**
 * Server Actions admin chauffeurs (clôture-bis Passe 1).
 *
 * Pattern (CLAUDE.md § 10) : useFormState → safeParse zod → guard rôle
 * dirigeant (defense in depth en plus de RLS Postgres
 * `drivers_insert_dirigeant` / `drivers_update_dirigeant`) → INSERT/UPDATE
 * → revalidatePath. Audit log automatique via trigger Postgres
 * `drivers_audit_trigger`.
 *
 * Pas de hard DELETE (CLAUDE.md anti-pattern) : `archiveDriverAction` pose
 * `archive=true` + `archive_at` + `actif=false`.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { driverInputSchema } from '@tap/shared';
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
  return driverInputSchema.safeParse({
    nom_affichage: formData.get('nom_affichage'),
    telephone: formData.get('telephone'),
    numero_licence: formData.get('numero_licence'),
    type_permis: formData.getAll('type_permis'),
    actif: formData.get('actif') === 'on',
  });
}

function flattenFieldErrors(
  err: z.ZodError,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(err.flatten().fieldErrors)) {
    if (v && v[0]) out[k] = v[0];
  }
  return out;
}

export async function createDriverAction(
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
    .from('drivers' as never)
    .insert({
      ...parsed.data,
      organization_id: ctx.organizationId,
      created_by: ctx.userId,
      telephone: parsed.data.telephone || null,
      numero_licence: parsed.data.numero_licence || null,
    } as never)
    .select('id')
    .single();

  if (error || !data) return { error: 'Création chauffeur impossible.' };
  revalidatePath('/admin/chauffeurs');
  return { success: true, id: (data as { id: string }).id };
}

export async function updateDriverAction(
  driverId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!z.string().uuid().safeParse(driverId).success) {
    return { error: 'Identifiant chauffeur invalide.' };
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
    .from('drivers' as never)
    .update({
      ...parsed.data,
      telephone: parsed.data.telephone || null,
      numero_licence: parsed.data.numero_licence || null,
    } as never)
    .eq('id', driverId)
    .eq('archive', false)
    .select('id')
    .maybeSingle();

  if (error) return { error: 'Modification impossible.' };
  if (!data) return { error: 'Chauffeur introuvable ou archivé.' };

  revalidatePath('/admin/chauffeurs');
  return { success: true, id: driverId };
}

export async function archiveDriverAction(
  driverId: string,
): Promise<ActionState> {
  if (!z.string().uuid().safeParse(driverId).success) {
    return { error: 'Identifiant chauffeur invalide.' };
  }

  const ctx = await requireDirigeant();
  if (!ctx) return { error: 'Accès dirigeant requis.' };

  const { error } = await ctx.supabase
    .from('drivers' as never)
    .update({
      archive: true,
      archive_at: new Date().toISOString(),
      actif: false,
    } as never)
    .eq('id', driverId);

  if (error) return { error: 'Archivage impossible.' };
  revalidatePath('/admin/chauffeurs');
  return { success: true };
}
