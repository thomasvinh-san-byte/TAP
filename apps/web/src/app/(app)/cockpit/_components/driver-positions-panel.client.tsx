'use client';

import * as React from 'react';
import { Map, type MapMarker } from '@/components/map/map.client';
import { type DriverPosition, formatPositionAge, positionTone } from '../_lib/use-driver-positions';
import { buildRideTrajectories } from '../_lib/ride-map';
import { buildDriverPopupData, renderDriverPopupHtml } from '../_lib/driver-popup';
import { DRIVER_LOAD_STATUSES } from '../_lib/driver-load';
import { formatReunionTime } from '../_lib/unassigned-h1';
import type { CockpitRide } from '../_lib/types';

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
  /** Positions live (remontées par le parent via useDriverPositions — DEC-096,
   *  lifté en COCKPIT-02 pour partager une seule subscription avec l'alerte). */
  positionsByDriver: Map<string, DriverPosition>;
  driverLabels: Record<string, string>;
  /** Courses du jour — pour tracer les trajets géocodés (COCKPIT-05). */
  rides: CockpitRide[];
  /**
   * Pont `profile_id` (identité de connexion portée par les positions) → clé
   * primaire `drivers.id` (portée par `rides.driver_id`). Permet de calculer la
   * charge du jour et la course en cours pour l'aperçu au clic (COCKPIT-06).
   */
  driverIdByProfileId: Record<string, string>;
}

const REUNION_CENTER = { lat: -21.1, lng: 55.55 };

export function DriverPositionsPanel({
  positionsByDriver,
  driverLabels,
  rides,
  driverIdByProfileId,
}: Props): JSX.Element {
  const [now, setNow] = React.useState<Date>(() => new Date());

  // Rafraîchir l'âge toutes les 30s — la position ne bouge pas, son âge si.
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const positions = Array.from(positionsByDriver.values()).sort((a, b) =>
    b.captured_at.localeCompare(a.captured_at),
  );

  const positionMarkers: MapMarker[] = positions.map((p) => {
    const name = driverLabels[p.driver_id] ?? 'Chauffeur';
    // `p.driver_id` = profile_id ; les courses portent `drivers.id` → pont.
    const driverPk = driverIdByProfileId[p.driver_id];
    const driverRides = driverPk ? rides.filter((r) => r.driver_id === driverPk) : [];
    const loadCount = driverRides.filter((r) => DRIVER_LOAD_STATUSES.has(r.status)).length;
    const enCours = driverRides.find((r) => r.status === 'en_cours') ?? null;
    const popup = buildDriverPopupData({
      name,
      capturedAt: p.captured_at,
      now,
      loadCount,
      currentRide: enCours
        ? {
            scheduledLabel: formatReunionTime(enCours.scheduled_at),
            dropoff: enCours.dropoff_address,
          }
        : null,
    });
    return {
      id: p.id,
      lat: p.lat,
      lng: p.lng,
      label: `${name} · ${formatPositionAge(p.captured_at, now)}`,
      tone: positionTone(p.captured_at, now),
      popupHtml: renderDriverPopupHtml(popup),
    };
  });

  // Trajets des courses du jour géocodées (départ, arrivée, ligne colorée). Les
  // positions restent affichées : les trajets s'AJOUTENT.
  const { markers: rideMarkers, lines } = React.useMemo(
    () => buildRideTrajectories(rides),
    [rides],
  );
  const markers: MapMarker[] = [...rideMarkers, ...positionMarkers];
  const hasTrajectories = lines.length > 0;

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
        <Map
          center={REUNION_CENTER}
          zoom={9}
          markers={markers}
          lines={lines}
          ariaLabel="Carte 974 : positions des chauffeurs et trajets des courses du jour"
        />
      </div>

      {/* Légende — les symboles ne reposent jamais sur la couleur seule. */}
      {hasTrajectories && (
        <ul
          className="text-muted-foreground flex flex-wrap items-center gap-x-16 gap-y-4 text-xs"
          aria-label="Légende de la carte"
        >
          <li className="flex items-center gap-4">
            <span
              className="border-background bg-foreground inline-block h-12 w-12 rounded-sm border-2"
              aria-hidden
            />
            Départ (carré)
          </li>
          <li className="flex items-center gap-4">
            <span
              className="border-foreground inline-block h-12 w-12 rounded-full border-[3px]"
              aria-hidden
            />
            Arrivée (anneau)
          </li>
          <li className="flex items-center gap-4">
            <span className="bg-primary inline-block h-12 w-12 rounded-full" aria-hidden />
            Position chauffeur
          </li>
          <li>Une couleur par course.</li>
        </ul>
      )}

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
