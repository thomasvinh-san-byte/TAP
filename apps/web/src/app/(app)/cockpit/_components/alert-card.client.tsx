'use client';

import {
  AlertTriangle,
  Clock,
  MessageSquareWarning,
  Wrench,
  CalendarClock,
  MapPinOff,
  ChevronDown,
} from 'lucide-react';
import type { CockpitAlert, CockpitAlertType } from '../_lib/types';
import { formatReunionTime, minutesUntil, H1_WINDOW_MIN } from '../_lib/unassigned-h1';
import { formatPositionAge, POSITION_STALE_MIN } from '../_lib/use-driver-positions';

const TITLES: Record<CockpitAlertType, string> = {
  patient_no_show: 'Patient absent',
  sms_failed: 'SMS non délivré',
  ride_delayed: 'Course en retard',
  driver_incident: 'Chauffeur indisponible',
  ride_unassigned_h1: 'Course non affectée',
  driver_position_stale: 'Position non remontée',
};

function iconFor(type: CockpitAlertType): JSX.Element {
  const cls = 'h-16 w-16 shrink-0';
  if (type === 'patient_no_show')
    return <AlertTriangle aria-hidden className={`${cls} text-destructive`} />;
  if (type === 'sms_failed')
    return <MessageSquareWarning aria-hidden className={`${cls} text-destructive`} />;
  if (type === 'driver_incident')
    return <Wrench aria-hidden className={`${cls} text-destructive`} />;
  if (type === 'ride_unassigned_h1')
    return <CalendarClock aria-hidden className={`${cls} text-destructive`} />;
  if (type === 'driver_position_stale')
    return <MapPinOff aria-hidden className={`${cls} text-destructive`} />;
  return <Clock aria-hidden className={`${cls} text-amber-600`} />;
}

/** Ligne secondaire spécifique : patient + heure de créneau pour H-1. */
function unassignedH1Detail(alert: CockpitAlert): string | null {
  if (alert.event_type !== 'ride_unassigned_h1') return null;
  const p = alert.payload as { patient_label?: string; scheduled_at?: string } | null;
  const label = p?.patient_label ?? 'Patient';
  const heure = p?.scheduled_at ? formatReunionTime(p.scheduled_at) : '';
  return heure ? `${label} · créneau ${heure} — non affectée` : `${label} — non affectée`;
}

/** Ligne secondaire spécifique : chauffeur + âge de la position pour géoloc. */
function stalePositionDetail(alert: CockpitAlert): string | null {
  if (alert.event_type !== 'driver_position_stale') return null;
  const p = alert.payload as { driver_label?: string; captured_at?: string | null } | null;
  const label = p?.driver_label ?? 'Chauffeur';
  if (!p?.captured_at) return `${label} · position jamais remontée`;
  return `${label} · ${formatPositionAge(p.captured_at)}`;
}

/** Seuil en langage clair : 60 → « 1 h », 5 → « 5 min ». */
function thresholdLabel(min: number): string {
  return min % 60 === 0 ? `${min / 60} h` : `${min} min`;
}

/** Proximité du créneau en langage clair (réutilise `minutesUntil`, pas de détection). */
function slotProximity(scheduledAtIso: string): string {
  const m = Math.round(minutesUntil(scheduledAtIso, Date.now()));
  if (m >= 1) return `créneau dans ${m} min`;
  if (m <= -1) return `créneau dépassé de ${-m} min`;
  return 'créneau imminent';
}

/**
 * « Pourquoi cette alerte ? » — explication concise du déclencheur, réservée aux
 * alertes CALCULÉES (dérivées d'un seuil / critère). Réutilise les données déjà
 * présentes dans le payload et les seuils de détection (aucun recalcul). Retourne
 * `null` pour les événements bruts (retard, no-show, SMS, incident), qui n'ont
 * pas de seuil à expliciter et restent inchangés.
 */
function alertReason(alert: CockpitAlert): string | null {
  if (alert.event_type === 'driver_position_stale') {
    const p = alert.payload as { captured_at?: string | null } | null;
    if (!p?.captured_at) return 'aucune position reçue pour ce chauffeur en service';
    return `position au-delà du seuil de ${thresholdLabel(POSITION_STALE_MIN)} sans mise à jour`;
  }
  if (alert.event_type === 'ride_unassigned_h1') {
    const p = alert.payload as { scheduled_at?: string } | null;
    const proximite = p?.scheduled_at ? slotProximity(p.scheduled_at) : 'créneau proche';
    return `course validée sans chauffeur, ${proximite} (seuil ${thresholdLabel(H1_WINDOW_MIN)})`;
  }
  return null;
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffD = Math.round(diffH / 24);
  return `il y a ${diffD} j`;
}

/**
 * Alerte COMPACTE : une seule ligne dense scannable (icône de gravité + intitulé
 * + détail), padding/bordures réduits — plus de grosse carte colorée par alerte.
 * Le « pourquoi » détaillé n'est plus déplié par défaut : il est accessible à la
 * demande via un `<details>` natif (clavier + lecteur d'écran), pour les alertes
 * calculées qui en portent un. La couleur/l'icône restent le repère de gravité.
 */
export function AlertCard({ alert }: { alert: CockpitAlert }): JSX.Element {
  const title = TITLES[alert.event_type];
  const detail =
    unassignedH1Detail(alert) ?? stalePositionDetail(alert) ?? formatRelativeTime(alert.created_at);
  // Explication du déclencheur (alertes calculées uniquement ; null sinon).
  const reason = alertReason(alert);

  const line = (
    <>
      {iconFor(alert.event_type)}
      <span className="min-w-0 flex-1 truncate text-sm">
        <span className="text-foreground font-medium">{title}</span>
        {detail && <span className="text-muted-foreground"> — {detail}</span>}
      </span>
    </>
  );

  // Sans « pourquoi » : simple ligne (pas de dépliable).
  if (!reason) {
    return (
      <div className="flex items-center gap-8 py-4" aria-label={title}>
        {line}
      </div>
    );
  }

  // Avec « pourquoi » : ligne + détail à la demande (natif, accessible).
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden">
      <summary
        className="focus-visible:ring-ring flex list-none items-center gap-8 rounded-md py-4 focus:outline-none focus-visible:ring-2"
        aria-label={`${title} — ${detail}. Pourquoi : ${reason}.`}
      >
        {line}
        <ChevronDown
          className="text-muted-foreground h-12 w-12 shrink-0 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <p className="text-muted-foreground pb-4 pl-24 text-xs">
        <span className="font-medium">Pourquoi : </span>
        {reason}
      </p>
    </details>
  );
}
