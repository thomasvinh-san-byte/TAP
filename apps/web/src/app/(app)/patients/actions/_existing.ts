'use server';

/**
 * Server Actions du référentiel patient (PLAN-5).
 *
 * Pattern (CLAUDE.md § 10) : Validation zod → Authz (RLS Postgres) →
 * Transaction → Audit log (trigger Postgres) → Réponse.
 *
 * Notes sécurité :
 *  - Le NIR clair n'est JAMAIS stocké dans le state ni dans un message.
 *    Il transite uniquement entre le formulaire (HTTPS server action) et
 *    l'Edge Function `nir`.
 *  - Les triggers Postgres `*_audit_trigger` (PLAN-2) génèrent les lignes
 *    `audit_logs` automatiquement (created / updated / archived / added /
 *    removed). L'action `patient.nir.decrypt` est insérée par l'Edge
 *    Function (PLAN-3).
 *  - `revalidatePath` après chaque mutation (RSC).
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { patientSchema, normalizePhone, replacePatientNote } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';
import { encryptAndHashNir, decryptNir as decryptNirEdge } from '@/lib/nir-client';
import { searchPatients, getPatientById } from '../queries';

export type ActionState = { error?: string; success?: boolean };

// --------------------------------------------------------------------------
// Helpers internes
// --------------------------------------------------------------------------

function parsePatientForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  return patientSchema.safeParse({
    prenom: raw.prenom,
    nom: raw.nom,
    date_naissance: raw.date_naissance,
    genre: raw.genre || undefined,
    telephone: raw.telephone || undefined,
    nir: raw.nir || undefined,
    adresse: {
      ligne1: raw.adresse_ligne1,
      ligne2: raw.adresse_ligne2 || undefined,
      code_postal: raw.code_postal,
      ville: raw.ville,
    },
    canal_contact_prefere: raw.canal_contact_prefere || 'appel',
    consentement_sms: raw.consentement_sms === 'on',
    consentement_sms_at: raw.consentement_sms === 'on' ? new Date().toISOString() : undefined,
    notes_operationnelles: raw.notes_operationnelles?.trim() || undefined,
    archive: false,
  });
}

// --------------------------------------------------------------------------
// CREATE
// --------------------------------------------------------------------------

export async function createPatientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }

  const supabase = await createClient();
  const data = parsed.data;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée. Reconnectez-vous.' };

  const profileRes = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const profile = profileRes.data as { organization_id: string } | null;
  if (!profile) return { error: 'Profil introuvable.' };

  // W-1 fix : un seul appel à l'Edge Function ; persistance atomique des 3 colonnes.
  let nirEncrypted: string | null = null;
  let nirHash: string | null = null;
  let nirLast4: string | null = null;
  if (data.nir) {
    try {
      const enc = await encryptAndHashNir(supabase, data.nir);
      nirEncrypted = enc.nir_encrypted;
      nirHash = enc.nir_search_hash;
      nirLast4 = enc.nir_last4;
    } catch (err) {
      // Reporté Phase 06 HDS : diagnostic 401 Edge Function nir
      // (env vars Edge Function ou JWT chain Server Action → invoke).
      // Workaround V1.5 : le NIR est optionnel, la régulatrice peut
      // créer le patient sans NIR et le compléter plus tard.
      console.error('[patient] NIR encryption failed (V1.5 deferred Phase 06):', err);
      return {
        error:
          'Chiffrement NIR temporairement indisponible. Vous pouvez créer le patient sans NIR pour la démo, ou réessayer plus tard.',
      };
    }
  }

  const { data: row, error } = await supabase
    .from('patients')
    .insert({
      organization_id: profile.organization_id,
      prenom: data.prenom,
      nom: data.nom,
      date_naissance: data.date_naissance,
      genre: data.genre ?? null,
      telephone: data.telephone ?? null,
      telephone_normalized: data.telephone ? normalizePhone(data.telephone) : null,
      adresse_ligne1: data.adresse.ligne1,
      adresse_ligne2: data.adresse.ligne2 ?? null,
      code_postal: data.adresse.code_postal,
      ville: data.adresse.ville,
      contact_urgence_nom: data.contact_urgence?.nom ?? null,
      contact_urgence_telephone: data.contact_urgence?.telephone ?? null,
      // bytea Postgres accepte un base64 string décodé via PostgREST.
      nir_encrypted: nirEncrypted,
      nir_search_hash: nirHash,
      nir_last4: nirLast4,
      canal_contact_prefere: data.canal_contact_prefere,
      consentement_sms: data.consentement_sms,
      consentement_sms_at: data.consentement_sms_at ?? null,
      archive: false,
      created_by: user.id,
    } as never)
    .select('id')
    .single();

  const insertedRow = row as { id: string } | null;
  if (error || !insertedRow) {
    return {
      error: 'Création impossible (un patient avec ce NIR existe peut-être déjà).',
    };
  }

  // Note opérationnelle initiale (B-1).
  if (data.notes_operationnelles && data.notes_operationnelles.length > 0) {
    await replacePatientNote(
      // Cast : signature 3-args Database vs SupabaseClient 4-args du runtime.
      supabase as never,
      insertedRow.id,
      data.notes_operationnelles,
      user.id,
    );
  }

  revalidatePath('/patients');
  redirect(`/patients/${insertedRow.id}`);
}

// --------------------------------------------------------------------------
// UPDATE
// --------------------------------------------------------------------------

export async function updatePatientAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parsePatientForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide.' };
  }
  const supabase = await createClient();
  const data = parsed.data;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Session expirée.' };

  const update: Record<string, unknown> = {
    prenom: data.prenom,
    nom: data.nom,
    date_naissance: data.date_naissance,
    genre: data.genre ?? null,
    telephone: data.telephone ?? null,
    telephone_normalized: data.telephone ? normalizePhone(data.telephone) : null,
    adresse_ligne1: data.adresse.ligne1,
    adresse_ligne2: data.adresse.ligne2 ?? null,
    code_postal: data.adresse.code_postal,
    ville: data.adresse.ville,
    canal_contact_prefere: data.canal_contact_prefere,
    consentement_sms: data.consentement_sms,
    consentement_sms_at: data.consentement_sms_at ?? null,
    updated_by: user.id,
  };

  // W-1 fix : si le NIR clair est fourni, chiffrer + persister atomiquement.
  // Le NIR clair ne doit JAMAIS arriver tel quel dans l'UPDATE Postgres.
  if (data.nir && data.nir.length > 0) {
    try {
      const enc = await encryptAndHashNir(supabase, data.nir);
      update.nir_encrypted = enc.nir_encrypted;
      update.nir_search_hash = enc.nir_search_hash;
      update.nir_last4 = enc.nir_last4;
    } catch (err) {
      // Reporté Phase 06 HDS (cf. CONCERNS.md — NIR Edge Function 401).
      console.error('[patient] NIR encryption failed (V1.5 deferred Phase 06):', err);
      return {
        error:
          'Chiffrement NIR temporairement indisponible. Vous pouvez enregistrer le patient sans modifier le NIR, ou réessayer plus tard.',
      };
    }
  }

  const { error } = await supabase
    .from('patients')
    .update(update as never)
    .eq('id', id);
  if (error) return { error: 'Modification impossible.' };

  // Note opérationnelle (B-1, pattern replaced_by_id D-18).
  if (typeof data.notes_operationnelles === 'string') {
    try {
      await replacePatientNote(supabase as never, id, data.notes_operationnelles, user.id);
    } catch {
      return { error: 'Note opérationnelle non enregistrée.' };
    }
  }

  revalidatePath('/patients');
  revalidatePath(`/patients/${id}`);
  redirect(`/patients/${id}`);
}

// --------------------------------------------------------------------------
// DECRYPT NIR
// --------------------------------------------------------------------------

export async function decryptNirAction(
  patientId: string,
): Promise<{ nir: string } | { error: string }> {
  const supabase = await createClient();
  const rawRes = await supabase
    .from('patients')
    .select('nir_encrypted')
    .eq('id', patientId)
    .single();
  const row = rawRes.data as { nir_encrypted: unknown } | null;
  if (rawRes.error || !row?.nir_encrypted) return { error: 'NIR introuvable.' };

  // bytea Postgres → base64 attendu par l'Edge Function.
  // PostgREST renvoie bytea encodé : soit hex (`\x...`) soit base64 selon réglage.
  const raw = row.nir_encrypted;
  let encryptedB64: string;
  if (typeof raw === 'string' && raw.startsWith('\\x')) {
    encryptedB64 = Buffer.from(raw.slice(2), 'hex').toString('base64');
  } else if (typeof raw === 'string') {
    encryptedB64 = raw;
  } else {
    encryptedB64 = Buffer.from(raw as Uint8Array).toString('base64');
  }

  try {
    const nir = await decryptNirEdge(supabase, encryptedB64, patientId);
    return { nir };
  } catch {
    return { error: 'NIR illisible.' };
  }
}

// --------------------------------------------------------------------------
// CONSTRAINTS (B-2) — voir `./constraints.actions.ts`
// --------------------------------------------------------------------------
// Les actions `addPatientConstraintAction` / `removePatientConstraintAction`
// sont dans un fichier séparé pour respecter la limite CLAUDE.md § 11
// (300 lignes max par fichier).

// --------------------------------------------------------------------------
// QUERY WRAPPERS (callable depuis Client Components via Server Actions)
// --------------------------------------------------------------------------

export async function searchPatientsAction(q: string, scope: 'active' | 'archived' = 'active') {
  return searchPatients(q, scope);
}

export async function getPatientByIdAction(id: string) {
  return getPatientById(id);
}
