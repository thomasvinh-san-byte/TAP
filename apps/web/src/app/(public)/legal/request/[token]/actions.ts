'use server';

import crypto from 'node:crypto';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  verifyRequestToken,
  generatePatientDataExport,
  anonymizePatient,
  nirFieldSchema,
} from '@tap/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tap/database';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit, markAttemptSuccess } from './_lib/rate-limit';

/**
 * Server Actions portail patient (D-10, DPA-04).
 *
 * Sécurité :
 *  - Service role uniquement (le portail bypass RLS, scoped au request_id du token).
 *  - Rate limit AVANT vérification (5 tentatives/h par token, D-20).
 *  - NIR clair présent uniquement dans la mémoire de l'action — jamais persisté
 *    côté apps/web. Le hash de recherche (HMAC-SHA256) est calculé localement
 *    avec la clé `APP_NIR_SEARCH_KEY` (mêmes secrets que l'Edge Function NIR
 *    Phase 1) pour interroger la RPC SECURITY DEFINER.
 *  - Erasure passe EXCLUSIVEMENT par `anonymizePatient` (RPC UPDATE only).
 *  - Aucun message technique au client (CLAUDE.md § 1).
 */

export type ActionState = { error?: string };

type DataRequestRow = {
  id: string;
  patient_id: string | null;
  request_type?: string;
  organization_id: string;
  status: string;
};

const identitySchema = z.object({
  nir: nirFieldSchema,
  nom: z.string().trim().min(1, 'Nom requis.').max(80),
  date_naissance: z.coerce.date({
    errorMap: () => ({ message: 'Date de naissance invalide.' }),
  }),
});

function computeNirSearchHash(nir: string): Buffer {
  const raw = process.env.APP_NIR_SEARCH_KEY;
  if (!raw) throw new Error('Configuration NIR manquante.');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('Configuration NIR invalide.');
  const normalized = nir.replace(/\s+/g, '').toUpperCase();
  return crypto.createHmac('sha256', key).update(normalized).digest();
}

async function loadRequest(
  sb: SupabaseClient<Database>,
  requestId: string,
  withType = false,
): Promise<DataRequestRow | null> {
  const cols = withType
    ? 'id, patient_id, request_type, organization_id, status'
    : 'id, patient_id, organization_id, status';
  const { data } = await sb.from('patient_data_request').select(cols).eq('id', requestId).single();
  return (data as DataRequestRow | null) ?? null;
}

export async function verifyIdentityAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get('token') ?? '');
  let dest: 'access' | 'erasure' | null = null;
  try {
    await checkRateLimit(token);
    const claims = await verifyRequestToken(token);
    const parsed = identitySchema.safeParse({
      nir: formData.get('nir'),
      nom: formData.get('nom'),
      date_naissance: formData.get('date_naissance'),
    });
    if (!parsed.success) {
      return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
    }
    const sb = createAdminClient();
    const request = await loadRequest(sb, claims.sub, true);
    if (!request || (request.status !== 'recue' && request.status !== 'en_cours')) {
      return { error: 'Identité non vérifiée.' };
    }
    const searchHash = computeNirSearchHash(parsed.data.nir);
    const { data: matchedId, error: matchError } = await sb.rpc(
      'nir_match_patient_for_legal_request',
      {
        p_request_id: request.id,
        p_nir_search_hash: `\\x${searchHash.toString('hex')}`,
        p_nom: parsed.data.nom,
        p_date_naissance: parsed.data.date_naissance.toISOString().slice(0, 10),
      },
    );
    if (matchError || !matchedId) {
      return { error: 'Identité non vérifiée.' };
    }
    await sb
      .from('patient_data_request')
      .update({
        status: 'en_cours',
        patient_id: matchedId as unknown as string,
      })
      .eq('id', request.id);
    await markAttemptSuccess(token);
    dest = request.request_type === 'effacement' ? 'erasure' : 'access';
  } catch (e) {
    // SÉCU-01 : portail public non authentifié — détail au journal serveur,
    // message générique à l'utilisateur (jamais le texte d'exception brut).
    console.error(
      '[legal request] verifyIdentityAction échec:',
      e instanceof Error ? e.message : e,
    );
    return { error: 'Une erreur est survenue. Réessayez plus tard.' };
  }
  if (dest) redirect(`/legal/request/${token}/${dest}`);
  return {};
}

export async function fulfillAccessAction(
  token: string,
): Promise<{ data?: unknown; error?: string }> {
  try {
    const claims = await verifyRequestToken(token);
    const sb = createAdminClient();
    const request = await loadRequest(sb, claims.sub);
    if (!request || !request.patient_id) {
      return { error: 'Demande introuvable.' };
    }
    if (request.status !== 'recue' && request.status !== 'en_cours') {
      return { error: 'Demande déjà traitée.' };
    }
    const data = await generatePatientDataExport(sb, request.patient_id);
    await sb.from('audit_logs').insert({
      organization_id: request.organization_id,
      actor_id: null,
      actor_role: null,
      action: 'patient.data_request.fulfilled',
      entity_type: 'patient_data_request',
      entity_id: request.id,
      metadata: { type: 'acces' },
    });
    await sb
      .from('patient_data_request')
      .update({ status: 'satisfaite', response_at: new Date().toISOString() })
      .eq('id', request.id);
    return { data };
  } catch (e) {
    // SÉCU-01 : détail au journal serveur, message générique à l'utilisateur.
    console.error('[legal request] fulfillAccessAction échec:', e instanceof Error ? e.message : e);
    return { error: 'Une erreur est survenue. Réessayez plus tard.' };
  }
}

export async function fulfillErasureAction(token: string): Promise<{ ok?: true; error?: string }> {
  try {
    const claims = await verifyRequestToken(token);
    const sb = createAdminClient();
    const request = await loadRequest(sb, claims.sub);
    if (!request || !request.patient_id) {
      return { error: 'Demande introuvable.' };
    }
    if (request.status !== 'recue' && request.status !== 'en_cours') {
      return { error: 'Demande déjà traitée.' };
    }
    await anonymizePatient(sb, request.patient_id, request.id);
    await sb
      .from('patient_data_request')
      .update({
        status: 'satisfaite',
        response_at: new Date().toISOString(),
        response: 'Anonymisation effectuée. Les courses sont conservées 5 ans (CSS L114-19).',
      })
      .eq('id', request.id);
    return { ok: true };
  } catch (e) {
    // SÉCU-01 : détail au journal serveur, message générique à l'utilisateur.
    console.error(
      '[legal request] fulfillErasureAction échec:',
      e instanceof Error ? e.message : e,
    );
    return { error: 'Une erreur est survenue. Réessayez plus tard.' };
  }
}
