'use server';

/**
 * Server Actions data_breach_incident (D-08).
 * Pattern : zod → auth → INSERT/UPDATE → revalidate.
 */

import { revalidatePath } from 'next/cache';
import { breachIncidentSchema } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';

export type ActionState = { error?: string; success?: boolean };

function parseBreachForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  return breachIncidentSchema.safeParse({
    detected_at: raw.detected_at || new Date().toISOString(),
    severity: raw.severity,
    nature: raw.nature,
    affected_data_categories: (raw.affected_data_categories ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    affected_subjects_count: raw.affected_subjects_count
      ? Number(raw.affected_subjects_count)
      : null,
    description: raw.description,
    immediate_measures: raw.immediate_measures,
    cnil_notification_required: raw.cnil_notification_required === 'on',
    cnil_notification_at: raw.cnil_notification_at?.trim() || null,
    cnil_notification_reference: raw.cnil_notification_reference?.trim() || null,
    subjects_notification_required: raw.subjects_notification_required === 'on',
    subjects_notified_at: raw.subjects_notified_at?.trim() || null,
  });
}

export async function createBreachAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // DEC-040 — guard require* partagé : action réservée au dirigeant.
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const parsed = parseBreachForm(formData);
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
  const { error } = await supabase.from('data_breach_incident').insert({
    organization_id: profile.organization_id,
    detected_at: data.detected_at.toISOString(),
    severity: data.severity,
    nature: data.nature,
    affected_data_categories: data.affected_data_categories,
    affected_subjects_count: data.affected_subjects_count ?? null,
    description: data.description,
    immediate_measures: data.immediate_measures,
    cnil_notification_required: data.cnil_notification_required,
    cnil_notification_at: data.cnil_notification_at
      ? data.cnil_notification_at.toISOString()
      : null,
    cnil_notification_reference: data.cnil_notification_reference ?? null,
    subjects_notification_required: data.subjects_notification_required,
    subjects_notified_at: data.subjects_notified_at
      ? data.subjects_notified_at.toISOString()
      : null,
    created_by: user.id,
  } as never);

  if (error) return { error: 'Création impossible.' };

  revalidatePath('/admin/legal/breaches');
  return { success: true };
}

export async function closeBreachAction(id: string): Promise<ActionState> {
  // DEC-040 — guard require* partagé : action réservée au dirigeant.
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée.' };

  const { error } = await supabase
    .from('data_breach_incident')
    .update({
      closed_at: new Date().toISOString(),
      closed_by: user.id,
    } as never)
    .eq('id', id);

  if (error) return { error: 'Fermeture impossible.' };
  revalidatePath('/admin/legal/breaches');
  return { success: true };
}
