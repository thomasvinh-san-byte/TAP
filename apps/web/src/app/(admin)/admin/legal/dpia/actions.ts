'use server';

/**
 * Server Actions DPIA (D-07).
 * createDpiaAction + updateDpiaAction + status workflow.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { dpiaSchema } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';

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
  // DEC-040 — guard require* partagé : action réservée au dirigeant.
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const parsed = parseDpiaForm(formData);
  if (!parsed.success) return { error: parsed.error };

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
  // DEC-040 — guard require* partagé : action réservée au dirigeant.
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const parsed = parseDpiaForm(formData);
  if (!parsed.success) return { error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée.' };

  const data = parsed.data;
  // DEC-041 row count check.
  const upd = await supabase
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
    .eq('id', id)
    .select('id');

  if (upd.error) return { error: 'Modification impossible.' };
  if (!upd.data || (upd.data as unknown[]).length === 0) {
    return { error: 'Modification refusée : droits insuffisants ou DPIA absente.' };
  }
  revalidatePath('/admin/legal/dpia');
  return { success: true };
}

const dpiaPrefillSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Titre requis.' }).max(200),
    scope: z.string().trim().min(1, { message: 'Périmètre requis.' }).max(2000),
    reviewed_at: z.coerce.date(),
    next_review_at: z.coerce.date(),
  })
  .refine((d) => d.next_review_at > d.reviewed_at, {
    message: 'La prochaine revue doit être postérieure à la date de revue.',
    path: ['next_review_at'],
  });

export type DpiaPrefillInput = {
  title: string;
  scope: string;
  reviewed_at: string;
  next_review_at: string;
};

/**
 * Crée une trame squelette DPIA (D-05).
 *
 * `risks_identified` et `mitigations` restent vides — TAP n'émet aucun
 * verdict de risque. Insérée en statut « brouillon », éditable et archivable.
 * Idempotence : refuse si une DPIA existe déjà.
 */
export async function prefillDpiaRecordAction(input: DpiaPrefillInput): Promise<ActionState> {
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const parsed = dpiaPrefillSchema.safeParse(input);
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

  const { count, error: countError } = await supabase
    .from('dpia_record')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id);
  if (countError) return { error: 'Vérification des DPIA impossible.' };
  if ((count ?? 0) > 0) return { error: 'Une analyse d’impact existe déjà.' };

  const d = parsed.data;
  const { error } = await supabase.from('dpia_record').insert({
    organization_id: profile.organization_id,
    title: d.title,
    scope: d.scope,
    data_flow_diagram: null,
    risks_identified: [],
    mitigations: [],
    residual_risk_level: null,
    cnil_consultation_required: false,
    cnil_consultation_date: null,
    reviewed_at: d.reviewed_at.toISOString().slice(0, 10),
    next_review_at: d.next_review_at.toISOString().slice(0, 10),
    status: 'brouillon',
    created_by: user.id,
  } as never);

  if (error) return { error: 'Création impossible.' };
  revalidatePath('/admin/legal/dpia');
  return { success: true };
}
