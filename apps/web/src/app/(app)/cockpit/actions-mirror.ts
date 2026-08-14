'use server';

/**
 * Server Action — données du miroir de consultation hors-ligne régulateur
 * (DEC-177, CdG §5.24). Renvoie le planning J + J+1 avec les CONTACTS
 * (téléphones patient + chauffeur) pour alimenter le store Dexie quand la
 * régulatrice est EN LIGNE. LECTURE SEULE — aucune écriture.
 *
 * RLS Postgres scope l'org ; guard rôle dirigeant/régulateur (pas le chauffeur).
 * Téléphones uniquement (aucune donnée NIR / médicale).
 */

import { reunionDayBoundsUtc, reunionDayKey } from '@tap/shared';
import { requireAdminOrRegulateur } from '@/lib/auth/require-admin-or-regulateur';
import { createClient } from '@/lib/supabase/server';
import type { PlanningMirrorRow } from '@/lib/offline/regulateur-db';

interface RawMirrorRide {
  id: string;
  scheduled_at: string;
  status: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  patient: { prenom: string | null; nom: string | null; telephone: string | null } | null;
  driver: { nom_affichage: string | null; telephone: string | null } | null;
}

export async function getRegulateurPlanningMirrorAction(): Promise<PlanningMirrorRow[]> {
  const ctx = await requireAdminOrRegulateur();
  if (!ctx) return [];

  const supabase = await createClient();
  // Jours civils réunionnais (UTC+4, aucune heure d'été), pas des jours UTC.
  // +24 h avance toujours d'un jour civil ici (offset fixe). Bornes via le helper
  // partagé (#497), cohérent avec le cockpit et le planning.
  const today = reunionDayKey(new Date().toISOString());
  const tomorrow = reunionDayKey(new Date(Date.now() + 86_400_000).toISOString());

  const { data, error } = await supabase
    .from('rides')
    .select(
      'id, scheduled_at, status, pickup_address, dropoff_address, ' +
        'patient:patients(prenom, nom, telephone), driver:drivers(nom_affichage, telephone)',
    )
    .gte('scheduled_at', reunionDayBoundsUtc(today).gte)
    .lt('scheduled_at', reunionDayBoundsUtc(tomorrow).lt)
    .neq('status', 'brouillon')
    .order('scheduled_at');
  if (error) {
    console.error('[mirror régulateur] lecture planning échouée:', error.message);
    return [];
  }

  const rides = (data as unknown as RawMirrorRide[] | null) ?? [];
  return rides.map((r) => ({
    id: r.id,
    scheduled_at: r.scheduled_at,
    status: r.status,
    pickup_address: r.pickup_address,
    dropoff_address: r.dropoff_address,
    patient_label: `${r.patient?.prenom ?? ''} ${r.patient?.nom ?? ''}`.trim(),
    patient_phone: r.patient?.telephone ?? null,
    driver_label: r.driver?.nom_affichage ?? null,
    driver_phone: r.driver?.telephone ?? null,
  }));
}
