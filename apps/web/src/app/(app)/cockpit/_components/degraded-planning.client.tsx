'use client';

import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CloudOff, Phone, AlertTriangle } from 'lucide-react';
import {
  getRegulateurSyncedAt,
  isPlanningStale,
  readRegulateurMirror,
} from '@/lib/offline/regulateur-db';
import { StatusBadge } from '../../courses/_components/ride-badges';

/**
 * Vue planning hors-ligne LECTURE SEULE (DEC-177, CdG §5.24). Affichée par
 * l'`OfflineGate` quand le réseau est coupé. Lit le miroir Dexie (J/J+1) ;
 * masque tout si le cache a plus de 4h (fraîcheur = sécurité métier). Contacts
 * patient/chauffeur cliquables (tel:). Aucune action d'écriture.
 */
function formatTimeFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Indian/Reunion',
  });
}

function formatDayFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function PhoneLink({ label, phone }: { label: string; phone: string | null }): JSX.Element | null {
  if (!phone) return null;
  return (
    <a href={`tel:${phone}`} className="text-info inline-flex items-center gap-4 hover:underline">
      <Phone className="h-12 w-12" aria-hidden />
      {label}
    </a>
  );
}

export function DegradedPlanning(): JSX.Element {
  const rows = useLiveQuery(() => readRegulateurMirror(), [], []);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getRegulateurSyncedAt().then((v) => {
      if (cancelled) return;
      setSyncedAt(v);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const stale = loaded && isPlanningStale(syncedAt);

  return (
    <div className="mx-auto max-w-[900px] space-y-16">
      <div
        role="status"
        className="border-warning/40 bg-warning/10 text-warning flex items-center gap-12 rounded-lg border px-16 py-12 text-sm font-semibold"
      >
        <CloudOff className="h-16 w-16 shrink-0" aria-hidden />
        <span>Mode dégradé — consultation seule (hors-ligne). Aucune saisie possible.</span>
      </div>

      {stale ? (
        <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-12 rounded-lg border px-16 py-16">
          <AlertTriangle className="mt-2 h-16 w-16 shrink-0" aria-hidden />
          <p className="text-sm">
            Données de plus de 4 heures, non fiables. Reconnectez-vous pour rafraîchir le planning
            avant toute décision.
          </p>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Aucune course en cache pour aujourd&apos;hui et demain.
        </p>
      ) : (
        <ul className="divide-border border-border divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.id} className="space-y-8 p-16">
              <div className="flex items-center justify-between gap-12">
                <span className="text-sm font-semibold tabular-nums">
                  {formatDayFr(r.scheduled_at)} · {formatTimeFr(r.scheduled_at)}
                </span>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-sm">{r.patient_label || 'Patient'}</p>
              <p className="text-muted-foreground text-xs">
                {r.pickup_address ?? '—'} → {r.dropoff_address ?? '—'}
              </p>
              <div className="flex flex-wrap items-center gap-x-16 gap-y-4 text-xs">
                <PhoneLink
                  label={`Patient${r.patient_phone ? '' : ' (pas de tél.)'}`}
                  phone={r.patient_phone}
                />
                <PhoneLink
                  label={r.driver_label ? `Chauffeur ${r.driver_label}` : 'Chauffeur'}
                  phone={r.driver_phone}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
