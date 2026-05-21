'use server';

/**
 * Server Actions patient_data_request (D-09, D-10).
 *
 * createDataRequestAction : la régulatrice initie une demande, génère un
 *   request_token JWT signé (jose, 30 jours, D-10) et l'enregistre. L'email
 *   au patient est V1.5 (intégration SMS Twilio Phase 8).
 * updateRequestStatusAction : workflow status + réponse + audit auto via trigger.
 */

import { revalidatePath } from 'next/cache';
import { dataRequestSchema, signRequestToken } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { requireDirigeant } from '@/lib/auth/require-dirigeant';

export type ActionState = { error?: string; success?: boolean };

const TOKEN_EXPIRY_MS = 30 * 24 * 3600_000; // 30 jours (D-10 — délai légal art. 12)

function parseRequestForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  return dataRequestSchema.safeParse({
    patient_id: raw.patient_id?.trim() || null,
    request_type: raw.request_type,
    requester_email: raw.requester_email?.trim() || null,
  });
}

export async function createDataRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // DEC-040 — guard require* partagé : action réservée au dirigeant.
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const parsed = parseRequestForm(formData);
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
  const requestedAt = new Date();
  const deadlineAt = new Date(requestedAt.getTime() + 30 * 24 * 3600_000);
  const tokenExpiresAt = new Date(requestedAt.getTime() + TOKEN_EXPIRY_MS);

  // Insert avec token placeholder, on remplace après signature.
  const { data: insertedRow, error: insertError } = await supabase
    .from('patient_data_request')
    .insert({
      organization_id: profile.organization_id,
      patient_id: data.patient_id ?? null,
      request_type: data.request_type,
      requester_email: data.requester_email ?? null,
      requested_at: requestedAt.toISOString(),
      deadline_at: deadlineAt.toISOString(),
      request_token: 'placeholder',
      request_token_expires_at: tokenExpiresAt.toISOString(),
      status: 'recue',
    } as never)
    .select('id, organization_id, request_type')
    .single();

  const inserted = insertedRow as {
    id: string;
    organization_id: string;
    request_type: string;
  } | null;
  if (insertError || !inserted) {
    return { error: 'Création demande impossible.' };
  }

  const token = await signRequestToken({
    sub: inserted.id,
    org: inserted.organization_id,
    type: inserted.request_type,
  });

  await supabase
    .from('patient_data_request')
    .update({ request_token: token } as never)
    .eq('id', inserted.id);

  // TODO Phase 8 — envoyer email avec lien https://app/legal/request/${token}
  revalidatePath('/admin/legal/requests');
  return { success: true };
}

export async function updateRequestStatusAction(
  id: string,
  status: 'en_cours' | 'satisfaite' | 'rejetee' | 'partiellement_satisfaite',
  response: string,
): Promise<ActionState> {
  // DEC-040 — guard require* partagé : action réservée au dirigeant.
  const guard = await requireDirigeant();
  if (!guard) return { error: 'Action réservée au dirigeant.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée.' };

  const { error } = await supabase
    .from('patient_data_request')
    .update({
      status,
      response,
      response_at: new Date().toISOString(),
      response_by: user.id,
    } as never)
    .eq('id', id);

  if (error) return { error: 'Mise à jour impossible.' };
  revalidatePath('/admin/legal/requests');
  return { success: true };
}
