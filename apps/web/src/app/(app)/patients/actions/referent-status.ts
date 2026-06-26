'use server';

/**
 * Statut référent légal d'un patient (DEC-172, T3) pour l'avertissement de
 * saisie course. Server Action RLS-scopée : lit UNIQUEMENT `date_naissance` et
 * `referent_nom` (aucun ciphertext NIR sélectionné — la règle patients_safe vise
 * le NIR ; ici on ne lit que deux colonnes non sensibles). Le statut « mineur »
 * est DÉRIVÉ de date_naissance (source unique, util pur `isMinor`).
 */

import { z } from 'zod';
import { isMinor } from '@tap/shared';
import { createClient } from '@/lib/supabase/server';

export type PatientReferentStatus = {
  isMinor: boolean;
  hasReferent: boolean;
};

export async function getPatientReferentStatusAction(
  patientId: string,
): Promise<PatientReferentStatus | null> {
  if (!z.string().uuid().safeParse(patientId).success) return null;
  const supabase = await createClient();
  // `as never` : referent_nom (DEC-172) absent de types.gen.ts jusqu'au resync.
  const { data, error } = await supabase
    .from('patients' as never)
    .select('date_naissance, referent_nom')
    .eq('id' as never, patientId as never)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { date_naissance: string | null; referent_nom: string | null };
  return {
    isMinor: row.date_naissance ? isMinor(row.date_naissance) : false,
    hasReferent: Boolean(row.referent_nom && row.referent_nom.trim().length > 0),
  };
}
