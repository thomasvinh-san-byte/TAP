import 'server-only';
import { createClient } from '@/lib/supabase/server';

/**
 * Statut de validation d'un jour de planning (Module 5.12 lot D). RLS Postgres
 * scope l'organisation. Erreur loggée → `null` (jamais de throw).
 */

export interface PlanningValidationStatus {
  validatedAt: string;
  notifiedDrivers: number;
  notifiedPatients: number;
}

export async function getPlanningValidation(
  date: string,
): Promise<PlanningValidationStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('planning_validations')
    .select('validated_at, notified_drivers, notified_patients')
    .eq('planning_date', date)
    .maybeSingle();
  if (error) {
    console.error('[planning] Erreur lecture validation:', error);
    return null;
  }
  if (!data) return null;
  const row = data as {
    validated_at: string;
    notified_drivers: number;
    notified_patients: number;
  };
  return {
    validatedAt: row.validated_at,
    notifiedDrivers: row.notified_drivers,
    notifiedPatients: row.notified_patients,
  };
}
