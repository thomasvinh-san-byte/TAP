'use client';

import { AlertTriangle, Clock, MessageSquareWarning, Wrench, CalendarClock } from 'lucide-react';
import type { CockpitAlert, CockpitAlertType } from '../_lib/types';
import { formatReunionTime } from '../_lib/unassigned-h1';

const TITLES: Record<CockpitAlertType, string> = {
  patient_no_show: 'Patient absent',
  sms_failed: 'SMS non délivré',
  ride_delayed: 'Course en retard',
  driver_incident: 'Chauffeur indisponible',
  ride_unassigned_h1: 'Course non affectée',
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

export function AlertCard({ alert }: { alert: CockpitAlert }): JSX.Element {
  const tone =
    alert.event_type === 'ride_delayed'
      ? 'border-amber-200 bg-amber-50'
      : 'border-destructive/30 bg-destructive/5';
  return (
    <article
      className={`flex items-start gap-12 rounded-md border p-12 ${tone}`}
      aria-label={TITLES[alert.event_type]}
    >
      {iconFor(alert.event_type)}
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">{TITLES[alert.event_type]}</p>
        <p className="text-muted-foreground mt-2 text-xs">
          {unassignedH1Detail(alert) ?? formatRelativeTime(alert.created_at)}
        </p>
      </div>
    </article>
  );
}
