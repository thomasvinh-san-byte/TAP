'use server';

/**
 * Server Actions atomiques pour les contraintes patient (B-2, PAT-05).
 *
 * - `addPatientConstraintAction` : valide via `patientConstraintInputSchema`,
 *   INSERT (RLS forcée), revalidate. Audit géré par trigger Postgres
 *   `patient_constraint_audit_trigger` (PLAN-2).
 * - `removePatientConstraintAction` : DELETE (RLS forcée). Audit idem.
 *
 * Les contraintes sont éditées en direct (pas dans le formulaire principal).
 * Cette séparation simplifie l'audit (1 ligne par opération) et évite les
 * soumissions imbriquées côté UI.
 */

import { revalidatePath } from 'next/cache';
import { patientConstraintInputSchema } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

export async function addPatientConstraintAction(
  patientId: string,
  type: string,
  note?: string,
): Promise<
  | { created: { id: string; type: string; note: string | null } }
  | { error: string }
> {
  const parsed = patientConstraintInputSchema.safeParse({
    patient_id: patientId,
    type,
    note,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Contrainte invalide.' };
  }
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée.' };

  const profileRes = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { organization_id: string } | null;
  if (!profile) return { error: 'Profil introuvable.' };

  const insertRes = await supabase
    .from('patient_constraint')
    .insert({
      organization_id: profile.organization_id,
      patient_id: patientId,
      type: parsed.data.type,
      note: parsed.data.note ?? null,
      created_by: user.id,
    } as never)
    .select('id, type, note')
    .single();
  const data = insertRes.data as
    | { id: string; type: string; note: string | null }
    | null;
  if (insertRes.error || !data) {
    return { error: 'Ajout de la contrainte impossible.' };
  }

  revalidatePath(`/patients/${patientId}`);
  return { created: data };
}

export async function removePatientConstraintAction(
  constraintId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = createClient();
  const { error } = await supabase
    .from('patient_constraint')
    .delete()
    .eq('id', constraintId);
  if (error) return { error: 'Suppression impossible.' };
  return { ok: true };
}
