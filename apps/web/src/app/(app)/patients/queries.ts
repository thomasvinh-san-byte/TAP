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
  /** ISO timestamp de la dernière course non archivée (≤ maintenant). */
  last_ride_at?: string | null;
  /** ISO timestamp de la prochaine course non archivée (> maintenant). */
  next_ride_at?: string | null;
}

/**
 * Recherche fuzzy patient via la RPC `search_patients` (pg_trgm).
 *
 * Comportement :
 * - `q` vide → retourne les 20 premiers patients non archivés (liste par défaut).
 * - `q` 1 char → retourne `[]` SANS aller en base (économie + alignement UI D-10).
 * - `q` ≥ 2 chars → RPC ; top 10 triés par similarity desc.
 *
 * Phase 3 (03-D) : pour chaque patient retourné, on ramène en deuxième
 * round-trip `last_ride_at` (max scheduled_at ≤ now) et `next_ride_at`
 * (min scheduled_at > now). On évite d'étendre la RPC `search_patients`
 * (migration coûteuse pour Passe 1) en faisant 2 requêtes paginées sur
 * `rides` (RLS-filtré same-org) puis aggregation JS.
 */
export type PatientArchiveScope = 'active' | 'archived';

export async function searchPatients(
  query: string,
  scope: PatientArchiveScope = 'active',
): Promise<PatientListItem[]> {
  const trimmed = query.trim();
  // Garde côté serveur : recherche < 2 chars retourne vide (D-10).
  if (trimmed.length > 0 && trimmed.length < 2) return [];

  const supabase = await createClient();
  const wantArchived = scope === 'archived';
  let items: PatientListItem[];

  if (trimmed.length >= 2) {
    // Hotfix 04.7-bis élargi : la RPC search_patients ne discrimine pas
    // par archive. On filtre en post-fetch côté JS pour cohérence rapide
    // (volume résultats < 50, négligeable).
    const { data, error } = await supabase.rpc('search_patients', { q: trimmed } as never);
    if (error) throw new Error('Recherche impossible');
    const rows = (data ?? []) as PatientSafeRow[];
    items = rows.filter((r) => (r.archive ?? false) === wantArchived).map(toListItem);
  } else {
    const { data, error } = await supabase
      .from('patients_safe')
      .select('id, nom, prenom, telephone, canal_contact_prefere, archive')
      .eq('archive', wantArchived)
      .order('nom', { ascending: true })
      .limit(20);
    if (error) throw new Error('Recherche impossible');
    items = (data ?? []).map(toListItem);
  }

  if (items.length === 0) return items;
  await hydratePatientRideAggregates(supabase, items);
  return items;
}

/**
 * Mute les items reçus en peuplant `last_ride_at` / `next_ride_at`.
 *
 * Stratégie : SELECT id de course + patient_id pour les patients de la
 * liste, tri scheduled_at asc, agrégation JS. Limit 500 pour borner le
 * payload (≤ 20 patients × 25 courses récentes = volume négligeable).
 * RLS filtre déjà par organization_id.
 */
async function hydratePatientRideAggregates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  items: PatientListItem[],
): Promise<void> {
  const ids = items.map((p) => p.id);
  if (ids.length === 0) return;

  const nowIso = new Date().toISOString();

  const [pastRes, nextRes] = await Promise.all([
    supabase
      .from('rides')
      .select('patient_id, scheduled_at')
      .in('patient_id', ids)
      .lte('scheduled_at', nowIso)
      .eq('archive', false)
      .order('scheduled_at', { ascending: false })
      .limit(500),
    supabase
      .from('rides')
      .select('patient_id, scheduled_at')
      .in('patient_id', ids)
      .gt('scheduled_at', nowIso)
      .eq('archive', false)
      .order('scheduled_at', { ascending: true })
      .limit(500),
  ]);

  const lastByPatient = new Map<string, string>();
  for (const row of (pastRes.data ?? []) as {
    patient_id: string;
    scheduled_at: string;
  }[]) {
    if (!lastByPatient.has(row.patient_id)) {
      lastByPatient.set(row.patient_id, row.scheduled_at);
    }
  }
  const nextByPatient = new Map<string, string>();
  for (const row of (nextRes.data ?? []) as {
    patient_id: string;
    scheduled_at: string;
  }[]) {
    if (!nextByPatient.has(row.patient_id)) {
      nextByPatient.set(row.patient_id, row.scheduled_at);
    }
  }
  for (const p of items) {
    p.last_ride_at = lastByPatient.get(p.id) ?? null;
    p.next_ride_at = nextByPatient.get(p.id) ?? null;
  }
}

function toListItem(row: Partial<PatientSafeRow>): PatientListItem {
  return {
    id: row.id ?? '',
    nom: row.nom ?? '',
    prenom: row.prenom ?? '',
    telephone: row.telephone ?? null,
    canal_contact_prefere: (row.canal_contact_prefere ??
      'appel') as PatientListItem['canal_contact_prefere'],
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
/**
 * Lecture des « smart defaults » de saisie express (Plan 03.1-01, D-A2-2).
 *
 * Retourne `transport_mode` + `urgency` de la dernière course non archivée
 * du patient, hors statuts d'annulation. Utilisé par
 * `getPatientRideDefaultsAction` pour pré-remplir silencieusement le modal
 * saisie express (D-A2-1 : aucun toast, aucun spinner).
 *
 * Filtre :
 *  - `patient_id = $patientId` ET `organization_id = $organizationId`
 *  - `archive = false`
 *  - `status ∈ {validee, assignee, en_cours, terminee}` (exclut `annulee_*`)
 *  - `order by scheduled_at desc limit 1`
 *
 * Silent fail : toute erreur Supabase ou résultat vide retourne `null`
 * (le pré-remplissage est non-critique — l'absence de défauts n'est pas
 * un bug, juste un patient sans historique exploitable).
 */
export async function getPatientRideDefaults(
  patientId: string,
  organizationId: string,
): Promise<{
  transport_mode: Database['public']['Enums']['ride_transport_mode'];
  urgency: Database['public']['Enums']['ride_urgency'];
} | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('rides')
    .select('transport_mode, urgency')
    .eq('patient_id', patientId)
    .eq('organization_id', organizationId)
    .eq('archive', false)
    .in('status', ['validee', 'assignee', 'en_cours', 'terminee'])
    .order('scheduled_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as {
    transport_mode: Database['public']['Enums']['ride_transport_mode'];
    urgency: Database['public']['Enums']['ride_urgency'];
  };
  return { transport_mode: row.transport_mode, urgency: row.urgency };
}

export async function getPatientById(id: string) {
  const supabase = await createClient();
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
