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
import { dataProcessingRegisterSchema } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

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
    international_transfer_safeguards:
      raw.international_transfer_safeguards?.trim() || null,
  });
}

export async function createDataProcessingRegisterAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseRegistreForm(formData);
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
    international_transfer_safeguards:
      data.international_transfer_safeguards ?? null,
    created_by: user.id,
    updated_by: user.id,
  } as never);

  if (error) return { error: 'Création impossible.' };

  revalidatePath('/admin/legal/registre');
  return { success: true };
}
