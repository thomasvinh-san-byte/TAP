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

/** Urgence du créneau, en très court : « dans 12 min » / « dépassé de 52 min ».
 *  Le mot « créneau » n'est pas répété (l'heure du créneau est déjà sur la ligne). */
function slotUrgency(scheduledAtIso: string): string {
  const m = Math.round(minutesUntil(scheduledAtIso, Date.now()));
  if (m >= 1) return `dans ${m} min`;
  if (m <= -1) return `dépassé de ${-m} min`;
  return 'imminent';
}

/**
 * Ligne factuelle pour H-1 : patient · créneau · urgence. La nature « non
 * affectée » est portée par le titre — on ne la répète pas ici.
 */
function unassignedH1Detail(alert: CockpitAlert): string | null {
  if (alert.event_type !== 'ride_unassigned_h1') return null;
  const p = alert.payload as { patient_label?: string; scheduled_at?: string } | null;
  const label = p?.patient_label ?? 'Patient';
  if (!p?.scheduled_at) return label;
  return `${label} · ${formatReunionTime(p.scheduled_at)} · ${slotUrgency(p.scheduled_at)}`;
}

/** Ligne secondaire spécifique : chauffeur + âge de la position pour géoloc. */
function stalePositionDetail(alert: CockpitAlert): string | null {
  if (alert.event_type !== 'driver_position_stale') return null;
  const p = alert.payload as { driver_label?: string; captured_at?: string | null } | null;
  const label = p?.driver_label ?? 'Chauffeur';
  // « non remontée » est déjà dans le titre : on ne le répète pas.
  if (!p?.captured_at) return `${label} · jamais remontée`;
  return `${label} · ${formatPositionAge(p.captured_at)}`;
}

/** Seuil en langage clair : 60 → « 1 h », 5 → « 5 min ». */
function thresholdLabel(min: number): string {
  return min % 60 === 0 ? `${min / 60} h` : `${min} min`;
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
    return `seuil : ${thresholdLabel(POSITION_STALE_MIN)} sans mise à jour`;
  }
  if (alert.event_type === 'ride_unassigned_h1') {
    // Patient, créneau et urgence sont déjà sur la ligne : le « pourquoi »
    // n'ajoute que le seuil qui déclenche l'alerte (pas de répétition).
    return `seuil d'affectation : ${thresholdLabel(H1_WINDOW_MIN)} avant le créneau`;
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
 *
 * Quand l'alerte porte une course (`ride_id`) et qu'un ouvreur de drawer est
 * fourni, une action explicite ouvre le drawer course (le même que depuis la
 * liste et la carte) : l'alerte devient le point d'entrée de sa résolution.
 * L'action N'affecte PAS elle-même — elle ouvre le drawer, qui porte
 * l'affectation et son garde-fou de validation. Aucune logique dupliquée.
 */
export function AlertCard({
  alert,
  onOpenRide,
}: {
  alert: CockpitAlert;
  /** Ouvre le drawer course (état unique du cockpit). Absent → pas d'action. */
  onOpenRide?: (rideId: string) => void;
}): JSX.Element {
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

  // Action « ouvrir la course » : présente dès que l'alerte porte un `ride_id`
  // et qu'un ouvreur est fourni. Libellé « Affecter » pour une course non
  // affectée (la résolution attendue = affecter), « Ouvrir » pour les autres.
  // Dans un `<summary>`, `preventDefault` empêche le clic de replier/déplier le
  // détail ; le bouton reste focusable et activable au clavier séparément.
  const rideId = alert.ride_id;
  const action =
    rideId && onOpenRide ? (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenRide(rideId);
        }}
        className="border-border text-foreground hover:bg-muted focus-visible:ring-ring shrink-0 rounded-md border px-8 py-2 text-xs font-medium focus:outline-none focus-visible:ring-2"
      >
        {alert.event_type === 'ride_unassigned_h1' ? 'Affecter' : 'Ouvrir'}
      </button>
    ) : null;

  // Sans « pourquoi » : simple ligne (pas de dépliable) + action éventuelle.
  if (!reason) {
    return (
      <div className="flex items-center gap-8 py-4" aria-label={title}>
        {line}
        {action}
      </div>
    );
  }

  // Avec « pourquoi » : ligne + détail à la demande (natif, accessible) + action.
  return (
    <details className="group [&_summary::-webkit-details-marker]:hidden">
      <summary
        className="focus-visible:ring-ring flex list-none items-center gap-8 rounded-md py-4 focus:outline-none focus-visible:ring-2"
        aria-label={`${title} — ${detail}. Pourquoi : ${reason}.`}
      >
        {line}
        {action}
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
