import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@tap/database/types';

/**
 * Remplace la note opérationnelle active d'un patient (pattern
 * `replaced_by_id`, D-18). Modèle historique en chaîne :
 *  1. SELECT note active (`replaced_by_id IS NULL`).
 *  2. Si contenu identique → no-op.
 *  3. INSERT nouvelle ligne + UPDATE ancienne.replaced_by_id = new.id.
 *
 * `newContent` peut être vide : effacement explicite, on insère une note
 * vide (compteur audit conservé) et marque l'ancienne comme remplacée.
 *
 * Helper pur (≤ 50 lignes) — réutilisable côté Server Action et tests.
 */
export async function replacePatientNote(
  supabase: SupabaseClient<Database>,
  patientId: string,
  newContent: string,
  authorId: string,
): Promise<void> {
  const { data: active } = await supabase
    .from('patient_operational_note')
    .select('id, content, organization_id')
    .eq('patient_id', patientId)
    .is('replaced_by_id', null)
    .maybeSingle();

  if (active && active.content === newContent) return;

  // Le déclencheur Postgres patient_operational_note_set_org_trigger remplit
  // organization_id depuis le patient. On le passe quand on l'a (cohérent
  // avec les types Insert obligatoires) — l'INSERT marche sans (RLS WITH
  // CHECK + trigger BEFORE INSERT le déduisent du patient_id).
  const orgId = active?.organization_id;
  const insertPayload: Database['public']['Tables']['patient_operational_note']['Insert'] = {
    patient_id: patientId,
    content: newContent,
    author_id: authorId,
    ...(orgId ? { organization_id: orgId } : ({} as { organization_id: string })),
  };

  const { data: inserted, error: insErr } = await supabase
    .from('patient_operational_note')
    .insert(insertPayload as never)
    .select('id')
    .single();
  if (insErr || !inserted) throw new Error('Note non enregistrée.');

  if (active) {
    await supabase
      .from('patient_operational_note')
      .update({ replaced_by_id: inserted.id })
      .eq('id', active.id);
  }
}
