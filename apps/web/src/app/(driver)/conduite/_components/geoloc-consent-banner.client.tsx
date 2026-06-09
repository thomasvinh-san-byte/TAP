'use client';

import * as React from 'react';
import { ChevronDown, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 10.0 prototype géoloc (DEC-096), refondu en notice par COUCHES
 * (Phase 06.55 DEC-134 D-02).
 *
 * Notice RGPD à deux couches (sourcé layered privacy notice) :
 *   - 1re couche TOUJOURS visible, courte mais informative : quoi + pourquoi
 *     + rétention.
 *   - « En savoir plus » (aria-expanded) déplie le détail : service
 *     uniquement, permission refusable (le pointage marche sans GPS), retrait.
 *
 * Pas de dark pattern : le refus / dismiss est aussi accessible que le reste.
 * Persistance dismiss : `localStorage` clé `geoloc:consent-ack` — ré-affiché
 * si l'utilisateur reset son navigateur.
 */

const STORAGE_KEY = 'geoloc:consent-ack';

export function GeolocConsentBanner(): JSX.Element | null {
  const [acked, setAcked] = React.useState<boolean | null>(null);
  const [expanded, setExpanded] = React.useState(false);

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
        {/* 1re couche : quoi + pourquoi + rétention. */}
        <p className="text-foreground font-medium">Position partagée à chaque pointage</p>
        <p className="text-muted-foreground mt-4 text-xs leading-[1.4]">
          À chaque pointage (démarrage, clôture, patient absent), votre position est captée et liée
          à la course. Conservée 90 j max.
        </p>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="geoloc-details"
          className="text-primary hover:text-primary/80 focus-visible:ring-ring mt-8 inline-flex items-center gap-4 rounded text-xs font-medium focus-visible:outline-none focus-visible:ring-2"
        >
          En savoir plus
          <ChevronDown
            className={cn('h-12 w-12 transition-transform duration-150', expanded && 'rotate-180')}
            aria-hidden
          />
        </button>

        {expanded ? (
          <div
            id="geoloc-details"
            className="text-muted-foreground mt-8 space-y-4 text-xs leading-[1.5]"
          >
            <p>
              Captée pendant le service uniquement, jamais en continu — seulement au moment du
              pointage.
            </p>
            <p>
              Vous pouvez refuser la permission GPS de votre téléphone : le pointage fonctionne
              quand même, sans position.
            </p>
            <p>
              Pour tout retrait ou question, contactez votre régulateur ou le DPO de la société.
            </p>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="J'ai compris, masquer"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring shrink-0 rounded p-4 focus-visible:outline-none focus-visible:ring-2"
      >
        <X className="h-16 w-16" aria-hidden />
      </button>
    </div>
  );
}
