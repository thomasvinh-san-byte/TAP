import type { CockpitAlert, CockpitAlertType } from './types';

/**
 * Priorité des alertes cockpit (§5.13, COCKPIT-01). La valeur d'un cockpit tient
 * au TRI des signaux : les alertes critiques (réaction immédiate attendue)
 * priment visuellement sur les alertes informatives. Introduit ici plutôt que
 * d'afficher tout à plat.
 */
export type AlertSeverity = 'critique' | 'info';

const SEVERITY: Record<CockpitAlertType, AlertSeverity> = {
  ride_unassigned_h1: 'critique',
  patient_no_show: 'critique',
  driver_incident: 'critique',
  // Perte de visibilité sur un chauffeur en course = angle mort opérationnel.
  driver_position_stale: 'critique',
  ride_delayed: 'info',
  sms_failed: 'info',
};

export function alertSeverity(type: CockpitAlertType): AlertSeverity {
  return SEVERITY[type] ?? 'info';
}

/** Tri stable : critiques d'abord, puis par récence (created_at décroissant). */
export function sortAlertsByPriority(alerts: CockpitAlert[]): CockpitAlert[] {
  const rank = (a: CockpitAlert): number => (alertSeverity(a.event_type) === 'critique' ? 0 : 1);
  return [...alerts].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}
