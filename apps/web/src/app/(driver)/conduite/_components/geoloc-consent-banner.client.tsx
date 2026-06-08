'use client';

import * as React from 'react';
import { MapPin, X } from 'lucide-react';

/**
 * Phase 10.0 prototype géoloc (DEC-096).
 *
 * Banner d'information chauffeur : à chaque pointage, la position GPS
 * est capturée et associée à la course. Service uniquement, conservée
 * 90 jours max. Non bloquant : si le chauffeur refuse la permission ou
 * dismiss le banner, le pointage reste fonctionnel.
 *
 * Persistance dismiss : `localStorage` clé `geoloc:consent-ack` —
 * ré-affiché si l'utilisateur reset son navigateur.
 */

const STORAGE_KEY = 'geoloc:consent-ack';

export function GeolocConsentBanner(): JSX.Element | null {
  const [acked, setAcked] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    try {
      setAcked(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      setAcked(false);
    }
  }, []);

  function dismiss(): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setAcked(true);
  }

  if (acked !== false) return null;

  return (
    <div
      role="region"
      aria-label="Information géolocalisation"
      className="border-border bg-muted/30 mb-12 flex items-start gap-12 rounded-md border p-12 text-sm"
    >
      <MapPin className="text-primary mt-2 h-16 w-16 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-foreground font-medium">Position partagée à chaque pointage</p>
        <p className="text-muted-foreground mt-4 text-xs leading-[1.4]">
          Aux pointages (démarrage, clôture, patient absent), votre position est captée et liée à la
          course. Service uniquement. Conservée 90 jours max. Vous pouvez refuser la permission GPS
          : le pointage fonctionne quand même.
        </p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="J'ai compris"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded p-4 focus-visible:outline-none focus-visible:ring-2"
      >
        <X className="h-16 w-16" aria-hidden />
      </button>
    </div>
  );
}
