'use server';

/**
 * Server Actions DPA record (D-06).
 * Pattern : zod → auth → INSERT → revalidatePath. RLS dirigeant only.
 */

import { revalidatePath } from 'next/cache';
import { dpaRecordSchema } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { error?: string; success?: boolean };

function parseDpaForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  return dpaRecordSchema.safeParse({
    subprocessor_name: raw.subprocessor_name,
    subprocessor_role: raw.subprocessor_role,
    dpa_version: raw.dpa_version,
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
