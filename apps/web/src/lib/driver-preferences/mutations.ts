import 'server-only';
import type { AuthContext } from '@/lib/auth/get-auth-context';

/**
 * Cœur partagé des mutations de préférences patient/chauffeur (PATIENT-02 +
 * CHAUFFEUR-03). Paramétré par `origin` plutôt que dupliqué entre les deux
 * directions. Pas de 'use server' : helpers serveur appelés par les Server
 * Actions (qui posent le guard de rôle + revalidatePath).
 *
 * Table `patient_driver_preference` absente de types.gen.ts → casts `as never`
 * (DEC-155). Sans motif (minimisation RGPD). Audit géré par trigger Postgres.
 */

export type PreferenceKind = 'prefere' | 'evite';
export type PreferenceOrigin = 'patient' | 'chauffeur';

export type AddPreferenceResult = { ok: true } | { conflict: PreferenceKind } | { error: string };

/**
 * Ajoute une préférence (idempotente si identique). Exclusion mutuelle PAR
 * direction : si le couple existe déjà dans cette origine avec l'autre `kind`,
 * retourne `{ conflict }` (l'action formule le message selon le sujet).
 */
export async function addPreference(
  ctx: AuthContext,
  args: { patientId: string; driverId: string; kind: PreferenceKind; origin: PreferenceOrigin },
): Promise<AddPreferenceResult> {
  const { patientId, driverId, kind, origin } = args;

  const existingRes = await ctx.supabase
    .from('patient_driver_preference' as never)
    .select('kind')
    .eq('patient_id', patientId)
    .eq('driver_id', driverId)
    .eq('origin' as never, origin as never)
    .maybeSingle();
  const existing = existingRes.data as { kind: PreferenceKind } | null;
  if (existing) {
    if (existing.kind === kind) return { ok: true };
    return { conflict: existing.kind };
  }

  const { error } = await ctx.supabase.from('patient_driver_preference' as never).insert({
    organization_id: ctx.organizationId,
    patient_id: patientId,
    driver_id: driverId,
    kind,
    origin,
    created_by: ctx.userId,
  } as never);
  if (error) return { error: 'Enregistrement de la préférence impossible.' };
  return { ok: true };
}

/** Retrait d'une préférence par id (RLS scope l'org ; DEC-041 row-count check). */
export async function removePreferenceById(
  ctx: AuthContext,
  preferenceId: string,
): Promise<{ ok: true } | { error: string }> {
  const { error, data } = await ctx.supabase
    .from('patient_driver_preference' as never)
    .delete()
    .eq('id', preferenceId)
    .select('id');
  if (error) return { error: 'Suppression impossible.' };
  if (!data || (data as unknown[]).length === 0) {
    return { error: 'Préférence introuvable : droits insuffisants.' };
  }
  return { ok: true };
}
