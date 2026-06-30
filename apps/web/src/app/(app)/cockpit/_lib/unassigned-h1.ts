import type { CockpitAlert, CockpitRide } from './types';

/**
 * Détection « course non affectée à H-1 » (§5.13, COCKPIT-01).
 *
 * Une course non affectée = statut `validee` (validée mais sans chauffeur ;
 * `assignee` signifierait affectée). Elle déclenche l'alerte quand son créneau
 * approche : `scheduled_at` à moins d'une heure (H-1), bornée côté passé pour ne
 * pas alerter sur des courses validées dont le créneau est largement dépassé.
 *
 * Le délai `scheduled_at - now` est un écart d'INSTANTS, donc indépendant du
 * fuseau (« moins d'une heure » est juste partout). Seul l'AFFICHAGE de l'heure
 * de créneau doit être en fuseau Réunion (`Indian/Reunion`) → `formatReunionTime`.
 *
 * Logique PURE (sans React) pour être testable et réutilisable par le ticker.
 */

/** Fenêtre d'alerte : créneau dans moins de 60 min. */
export const H1_WINDOW_MIN = 60;
/** Tolérance passé : on alerte encore jusqu'à 60 min après un créneau non affecté. */
export const H1_PAST_GRACE_MIN = 60;

/** Minutes (signées) entre maintenant et le créneau (>0 = à venir). */
export function minutesUntil(scheduledAtIso: string, nowMs: number): number {
  return (new Date(scheduledAtIso).getTime() - nowMs) / 60_000;
}

/** Vrai si la course est `validee` et son créneau dans la fenêtre H-1. */
export function isUnassignedH1(ride: CockpitRide, nowMs: number): boolean {
  if (ride.status !== 'validee') return false;
  const mins = minutesUntil(ride.scheduled_at, nowMs);
  if (Number.isNaN(mins)) return false;
  return mins <= H1_WINDOW_MIN && mins >= -H1_PAST_GRACE_MIN;
}

/** Courses non affectées à H-1, triées par créneau le plus proche d'abord. */
export function findUnassignedH1Rides(rides: CockpitRide[], nowMs: number): CockpitRide[] {
  return rides
    .filter((r) => isUnassignedH1(r, nowMs))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
}

/** Heure de créneau formatée en fuseau Réunion (HH:mm). */
export function formatReunionTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Indian/Reunion',
  }).format(d);
}

function patientLabel(ride: CockpitRide): string {
  const p = ride.patient;
  if (!p) return 'Patient';
  return [p.nom, p.prenom].filter(Boolean).join(' ').trim() || 'Patient';
}

/** Convertit les courses non affectées en alertes cockpit (type dédié). */
export function unassignedH1ToAlerts(rides: CockpitRide[], nowMs: number): CockpitAlert[] {
  return findUnassignedH1Rides(rides, nowMs).map((r) => ({
    id: `unassigned-h1:${r.id}`,
    ride_id: r.id,
    event_type: 'ride_unassigned_h1',
    payload: { patient_label: patientLabel(r), scheduled_at: r.scheduled_at },
    created_at: new Date(nowMs).toISOString(),
  }));
}
