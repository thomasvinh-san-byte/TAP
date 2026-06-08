'use client';

import * as React from 'react';
import { Map, type MapMarker } from '@/components/map/map.client';
import {
  useDriverPositions,
  type DriverPosition,
  formatPositionAge,
  positionTone,
} from '../_lib/use-driver-positions';

/**
 * Phase 10.0 prototype géoloc (DEC-096).
 *
 * Panneau carte du cockpit. Affiche la dernière position connue par
 * chauffeur, avec :
 *   - un marqueur (tone primary/muted selon fraîcheur),
 *   - un label obligatoire « vu il y a X min » — JAMAIS « live ».
 *
 * Mode démo : le badge « DÉMO » est affiché si au moins une position
 * est `source='demo'` (signal d'honnêteté envers la régulatrice et le
 * design partner — on ne vend pas du faux).
 */

interface Props {
  initial: DriverPosition[];
  driverLabels: Record<string, string>;
}

const REUNION_CENTER = { lat: -21.1, lng: 55.55 };

export function DriverPositionsPanel({ initial, driverLabels }: Props): JSX.Element {
  const { positionsByDriver } = useDriverPositions(initial);
  const [now, setNow] = React.useState<Date>(() => new Date());

  // Rafraîchir l'âge toutes les 30s — la position ne bouge pas, son âge si.
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const positions = Array.from(positionsByDriver.values()).sort((a, b) =>
    b.captured_at.localeCompare(a.captured_at),
  );

  const markers: MapMarker[] = positions.map((p) => ({
    id: p.id,
    lat: p.lat,
    lng: p.lng,
    label: `${driverLabels[p.driver_id] ?? 'Chauffeur'} · ${formatPositionAge(p.captured_at, now)}`,
    tone: positionTone(p.captured_at, now),
  }));

  const hasDemo = positions.some((p) => p.source === 'demo');

  return (
    <section
      aria-label="Positions des chauffeurs"
      className="bg-background border-border flex flex-col gap-12 rounded-lg border p-16"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Carte des chauffeurs</h2>
        {hasDemo && (
          <span
            className="border-border bg-muted text-muted-foreground rounded-full border px-8 py-2 text-xs font-medium"
            title="Positions fictives. Aucune vraie position n'est persistée tant que HDS n'est pas en place (DEC-075)."
          >
            DÉMO
          </span>
        )}
      </header>

      <p className="text-muted-foreground text-sm">
        Dernière position connue à chaque pointage. Pas de suivi continu. Le marqueur indique
        l&apos;âge de la donnée : il ne reflète pas une position « en direct ».
      </p>

      <div className="h-[320px] w-full">
        <Map center={REUNION_CENTER} zoom={9} markers={markers} ariaLabel="Carte 974 chauffeurs" />
      </div>

      {/* Liste textuelle — accessibilité clavier + lecteur d'écran. */}
      {positions.length === 0 ? (
        <p className="text-muted-foreground text-base">
          Aucune position connue. Les positions apparaissent au prochain pointage chauffeur.
        </p>
      ) : (
        <ul className="space-y-4" aria-label="Liste des dernières positions">
          {positions.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-8 text-sm">
              <span className="text-foreground font-medium">
                {driverLabels[p.driver_id] ?? p.driver_id.slice(0, 8)}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {formatPositionAge(p.captured_at, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
