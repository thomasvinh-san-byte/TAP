'use server';

/**
 * Server Actions — Registre des traitements (D-05).
 *
 * D-05 : versioning par lignes — pas de UPDATE destructif.
 * Chaque édition = nouvelle ligne (created_at plus récent).
 * Aucun `updateAction` exporté volontairement.
 *
 * Pattern : zod validation → auth user check → INSERT → revalidatePath.
 * RLS Postgres D-18 applique le check rôle dirigeant.
 */

import { revalidatePath } from 'next/cache';
import { dataProcessingRegisterSchema, type DataProcessingRegisterInput } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';

export type ActionState = { error?: string; success?: boolean };

function parseRegistreForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  return dataProcessingRegisterSchema.safeParse({
    purpose: raw.purpose,
    legal_basis: raw.legal_basis,
    data_categories: (raw.data_categories ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    data_subjects: (raw.data_subjects ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    recipients: (raw.recipients ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    retention_period_days: Number(raw.retention_period_days),
    security_measures: raw.security_measures,
    international_transfer: raw.international_transfer === 'on',
    international_transfer_safeguards: raw.international_transfer_safeguards?.trim() || null,
  });
}

export async function createDataProcessingRegisterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // DEC-040 — guard require* partagé : action réservée au dirigeant.
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const parsed = parseRegistreForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }

  const supabase = await createClient();
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

  const data = parsed.data;
  const { error } = await supabase.from('data_processing_register').insert({
    organization_id: profile.organization_id,
    purpose: data.purpose,
    legal_basis: data.legal_basis,
    data_categories: data.data_categories,
    data_subjects: data.data_subjects,
    recipients: data.recipients,
    retention_period_days: data.retention_period_days,
    security_measures: data.security_measures,
    international_transfer: data.international_transfer,
    international_transfer_safeguards: data.international_transfer_safeguards ?? null,
    created_by: user.id,
    updated_by: user.id,
  });

  if (error) return { error: 'Création impossible.' };

  revalidatePath('/admin/legal/registre');
  return { success: true };
}

export type PrefillState = { error?: string; success?: boolean; inserted?: number };

/**
 * Pré-remplissage en lot du registre (D-02b / D-09).
 *
 * Insère uniquement les entrées transmises — celles que le dirigeant a
 * cochées sur l'écran de revue (Wave 2). Jamais d'INSERT direct non validé :
 * le registre est append-only (pas de policy DELETE).
 *
 * Idempotence forte : refuse si le registre contient déjà des entrées —
 * empêche le double pré-remplissage même avec deux onglets ouverts.
 *
 * L'audit est écrit automatiquement par le trigger
 * `data_processing_register_audit_trigger` (D-11).
 */
export async function prefillDataProcessingRegisterAction(
  entries: DataProcessingRegisterInput[],
): Promise<PrefillState> {
  // DEC-040 — guard require* partagé : action réservée au dirigeant.
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  if (entries.length === 0) return { error: 'Aucune entrée à insérer.' };

  const supabase = await createClient();
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

  // Idempotence forte (D-09) : refuser si le registre n'est pas vide.
  const { count, error: countError } = await supabase
    .from('data_processing_register')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id);
  if (countError) return { error: 'Vérification du registre impossible.' };
  if ((count ?? 0) > 0) return { error: 'Le registre contient déjà des entrées.' };

  // Valider chaque entrée ; rejeter le lot entier si une seule est invalide.
  const rows = [];
  for (const entry of entries) {
    const parsed = dataProcessingRegisterSchema.safeParse(entry);
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Entrée invalide.' };
    }
    const d = parsed.data;
    rows.push({
      organization_id: profile.organization_id,
      purpose: d.purpose,
      legal_basis: d.legal_basis,
      data_categories: d.data_categories,
      data_subjects: d.data_subjects,
      recipients: d.recipients,
      retention_period_days: d.retention_period_days,
      security_measures: d.security_measures,
      international_transfer: d.international_transfer,
      international_transfer_safeguards: d.international_transfer_safeguards ?? null,
      created_by: user.id,
      updated_by: user.id,
    });
  }

  const { error } = await supabase.from('data_processing_register').insert(rows);
  if (error) return { error: 'Insertion impossible.' };

  revalidatePath('/admin/legal/registre');
  return { success: true, inserted: rows.length };
}
