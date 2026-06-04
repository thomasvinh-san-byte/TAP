'use server';

/**
 * Server Actions DPA record (D-06).
 * Pattern : zod → auth → INSERT → revalidatePath. RLS dirigeant only.
 */

import { revalidatePath } from 'next/cache';
import { dpaRecordSchema } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';

export type ActionState = { error?: string; success?: boolean };

function parseDpaForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  // PR3 06.17 — normalisation submit : trim sur toutes les saisies texte.
  // Pas de Title Case sur subprocessor_name (les marques/services
  // sous-traitants ont leur casse canonique propre — OVH, AWS, etc.).
  return dpaRecordSchema.safeParse({
    subprocessor_name: raw.subprocessor_name?.trim(),
    subprocessor_role: raw.subprocessor_role?.trim(),
    dpa_version: raw.dpa_version?.trim(),
    dpa_document_url: raw.dpa_document_url?.trim() || null,
    signed_at: raw.signed_at,
    expires_at: raw.expires_at?.trim() || null,
    notes: raw.notes?.trim() || null,
  });
}

export async function createDpaRecordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // DEC-040 — guard require* partagé : action réservée au dirigeant.
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const parsed = parseDpaForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
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

  const data = parsed.data;
  const { error } = await supabase.from('dpa_record').insert({
    organization_id: profile.organization_id,
    subprocessor_name: data.subprocessor_name,
    subprocessor_role: data.subprocessor_role,
    dpa_version: data.dpa_version,
    dpa_document_url: data.dpa_document_url ?? null,
    signed_at: data.signed_at.toISOString().slice(0, 10),
    expires_at: data.expires_at ? data.expires_at.toISOString().slice(0, 10) : null,
    notes: data.notes ?? null,
    created_by: user.id,
  } as never);

  if (error) return { error: 'Création impossible.' };

  revalidatePath('/admin/legal/dpa');
  return { success: true };
}

export type DpaPrefillInput = {
  subprocessor_name: string;
  subprocessor_role: string;
  dpa_version: string;
  signed_at: string;
  notes: string;
};

export type PrefillState = { error?: string; success?: boolean; inserted?: number };

/**
 * Pré-remplissage en lot des fiches DPA des sous-traitants techniques (D-04).
 *
 * Insère uniquement les fiches transmises (cochées sur l'écran de revue).
 * Idempotence : refuse si la liste DPA contient déjà des fiches.
 */
export async function prefillDpaRecordsAction(entries: DpaPrefillInput[]): Promise<PrefillState> {
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  if (entries.length === 0) return { error: 'Aucune fiche à insérer.' };

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

  const { count, error: countError } = await supabase
    .from('dpa_record')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id);
  if (countError) return { error: 'Vérification des fiches DPA impossible.' };
  if ((count ?? 0) > 0) return { error: 'Des fiches DPA existent déjà.' };

  const rows = [];
  for (const entry of entries) {
    const parsed = dpaRecordSchema.safeParse({
      subprocessor_name: entry.subprocessor_name,
      subprocessor_role: entry.subprocessor_role,
      dpa_version: entry.dpa_version,
      dpa_document_url: null,
      signed_at: entry.signed_at,
      expires_at: null,
      notes: entry.notes.trim() || null,
    });
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Fiche invalide.' };
    }
    const d = parsed.data;
    rows.push({
      organization_id: profile.organization_id,
      subprocessor_name: d.subprocessor_name,
      subprocessor_role: d.subprocessor_role,
      dpa_version: d.dpa_version,
      dpa_document_url: null,
      signed_at: d.signed_at.toISOString().slice(0, 10),
      expires_at: null,
      notes: d.notes ?? null,
      created_by: user.id,
    });
  }

  const { error } = await supabase.from('dpa_record').insert(rows as never);
  if (error) return { error: 'Insertion impossible.' };

  revalidatePath('/admin/legal/dpa');
  return { success: true, inserted: rows.length };
}
