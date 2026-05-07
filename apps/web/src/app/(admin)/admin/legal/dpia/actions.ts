'use server';

/**
 * Server Actions DPIA (D-07).
 * createDpiaAction + updateDpiaAction + status workflow.
 */

import { revalidatePath } from 'next/cache';
import { dpiaSchema } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

export type ActionState = { error?: string; success?: boolean };

function safeJsonParse(raw: string | undefined): unknown {
  if (!raw || !raw.trim()) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseDpiaForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  const risks = safeJsonParse(raw.risks_identified);
  const mitigations = safeJsonParse(raw.mitigations);
  if (risks === null || mitigations === null) {
    return { success: false as const, error: 'JSON risques/mesures invalide.' };
  }
  const result = dpiaSchema.safeParse({
    title: raw.title,
    scope: raw.scope,
    data_flow_diagram: raw.data_flow_diagram?.trim() || null,
    risks_identified: risks,
    mitigations,
    residual_risk_level: raw.residual_risk_level,
    cnil_consultation_required: raw.cnil_consultation_required === 'on',
    cnil_consultation_date: raw.cnil_consultation_date?.trim() || null,
    reviewed_at: raw.reviewed_at,
    next_review_at: raw.next_review_at,
    status: raw.status,
  });
  return result.success
    ? { success: true as const, data: result.data }
    : {
        success: false as const,
        error: result.error.errors[0]?.message ?? 'Saisie invalide.',
      };
}

export async function createDpiaAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseDpiaForm(formData);
  if (!parsed.success) return { error: parsed.error };

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
  const { error } = await supabase.from('dpia_record').insert({
    organization_id: profile.organization_id,
    title: data.title,
    scope: data.scope,
    data_flow_diagram: data.data_flow_diagram ?? null,
    risks_identified: data.risks_identified,
    mitigations: data.mitigations,
    residual_risk_level: data.residual_risk_level,
    cnil_consultation_required: data.cnil_consultation_required,
    cnil_consultation_date: data.cnil_consultation_date
      ? data.cnil_consultation_date.toISOString().slice(0, 10)
      : null,
    reviewed_at: data.reviewed_at.toISOString().slice(0, 10),
    next_review_at: data.next_review_at.toISOString().slice(0, 10),
    status: data.status,
    created_by: user.id,
  } as never);

  if (error) return { error: 'Création impossible.' };
  revalidatePath('/admin/legal/dpia');
  return { success: true };
}

export async function updateDpiaAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseDpiaForm(formData);
  if (!parsed.success) return { error: parsed.error };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée.' };

  const data = parsed.data;
  const { error } = await supabase
    .from('dpia_record')
    .update({
      title: data.title,
      scope: data.scope,
      data_flow_diagram: data.data_flow_diagram ?? null,
      risks_identified: data.risks_identified,
      mitigations: data.mitigations,
      residual_risk_level: data.residual_risk_level,
      cnil_consultation_required: data.cnil_consultation_required,
      cnil_consultation_date: data.cnil_consultation_date
        ? data.cnil_consultation_date.toISOString().slice(0, 10)
        : null,
      reviewed_at: data.reviewed_at.toISOString().slice(0, 10),
      next_review_at: data.next_review_at.toISOString().slice(0, 10),
      status: data.status,
    } as never)
    .eq('id', id);

  if (error) return { error: 'Modification impossible.' };
  revalidatePath('/admin/legal/dpia');
  return { success: true };
}
