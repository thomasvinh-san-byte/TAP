/**
 * Queries patient (RSC + Server Actions).
 *
 * Toutes les lectures passent par la vue `patients_safe` (B-5 fix) qui
 * exclut `nir_encrypted` et `nir_search_hash`. Le ciphertext NIR ne quitte
 * jamais Postgres → Edge Function.
 *
 * - `searchPatients(q)` : RPC `search_patients(q)` (pg_trgm + RLS via vue).
 *   Garde 2 chars côté serveur pour aligner avec l'UI (D-10).
 * - `getPatientById(id)` : SELECT vue + jointures contraintes / note active.
 */
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@tap/database/types';

export type PatientSafeRow = Database['public']['Views']['patients_safe']['Row'];

export interface PatientListItem {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  canal_contact_prefere: 'sms' | 'appel' | 'aucun';
  archive: boolean;
}

/**
 * Recherche fuzzy patient via la RPC `search_patients` (pg_trgm).
 *
 * Comportement :
 * - `q` vide → retourne les 20 premiers patients non archivés (liste par défaut).
 * - `q` 1 char → retourne `[]` SANS aller en base (économie + alignement UI D-10).
 * - `q` ≥ 2 chars → RPC ; top 10 triés par similarity desc.
 */
export async function searchPatients(
  query: string,
): Promise<PatientListItem[]> {
  const trimmed = query.trim();
  // Garde côté serveur : recherche < 2 chars retourne vide (D-10).
  if (trimmed.length > 0 && trimmed.length < 2) return [];

  const supabase = createClient();

  if (trimmed.length >= 2) {
    // RPC créée par PLAN-2 Wave 1, retourne setof patients_safe.
    // Cast args en `as never` : @supabase/supabase-js 2.105 attend un type
    // `Args = never` par défaut sur rpc() ; le typage strict s'effectue via
    // l'inférence du nom de fonction côté Database['public']['Functions'].
    const { data, error } = await supabase.rpc(
      'search_patients',
      { q: trimmed } as never,
    );
    if (error) throw new Error('Recherche impossible');
    const rows = (data ?? []) as PatientSafeRow[];
    return rows.map(toListItem);
  }

  // Liste par défaut : 20 premiers patients non archivés depuis la vue safe.
  const { data, error } = await supabase
    .from('patients_safe')
    .select(
      'id, nom, prenom, telephone, canal_contact_prefere, archive',
    )
    .eq('archive', false)
    .order('nom', { ascending: true })
    .limit(20);
  if (error) throw new Error('Recherche impossible');
  return (data ?? []).map(toListItem);
}

function toListItem(row: Partial<PatientSafeRow>): PatientListItem {
  return {
    id: row.id ?? '',
    nom: row.nom ?? '',
    prenom: row.prenom ?? '',
    telephone: row.telephone ?? null,
    canal_contact_prefere:
      (row.canal_contact_prefere ?? 'appel') as PatientListItem['canal_contact_prefere'],
    archive: row.archive ?? false,
  };
}

/**
 * Lecture patient complète depuis la vue `patients_safe` + jointures.
 *
 * CRITIQUE — sécurité B-5 : on lit la VUE `patients_safe`, jamais la table
 * `patients`. La vue exclut `nir_encrypted` et `nir_search_hash` ; elle
 * expose `nir_last4` (clair, non secret) et `has_nir` (booléen). Aucun
 * ciphertext NIR ne traverse le réseau jusqu'au browser.
 *
 * Jointures :
 *  - `patient_constraint` : toutes les contraintes du patient.
 *  - `patient_operational_note` : note active uniquement (`replaced_by_id is null`).
 */
export async function getPatientById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('patients_safe')
    .select(
      `
      id, organization_id, prenom, nom, date_naissance, genre, telephone,
      adresse_ligne1, adresse_ligne2, code_postal, ville,
      contact_urgence_nom, contact_urgence_telephone,
      nir_last4, has_nir,
      canal_contact_prefere, consentement_sms, consentement_sms_at,
      archive, created_at, updated_at,
      patient_constraint:patient_constraint!patient_constraint_patient_id_fkey(id, type, note, created_at),
      patient_operational_note:patient_operational_note!patient_operational_note_patient_id_fkey(id, content, author_id, replaced_by_id, created_at)
      `,
    )
    .eq('id', id)
    .is('patient_operational_note.replaced_by_id', null)
    .single();
  if (error || !data) throw new Error('Patient introuvable');
  return data;
}
