'use client';

import * as React from 'react';
import { Map, type MapMarker } from '@/components/map/map.client';
import { cn } from '@/lib/utils';
import { type DriverPosition, formatPositionAge, positionTone } from '../_lib/use-driver-positions';
import { buildRideTrajectories } from '../_lib/ride-map';
import { buildDriverPopupData, renderDriverPopupHtml } from '../_lib/driver-popup';
import { driverColor } from '../_lib/driver-map-link';
import { getGroupColor } from '../optimisation/_lib/group-colors';
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

// Couleur d'exemple pour le trait « trajet » de la légende — une des teintes de la
// palette de courses (la couleur réelle varie par course). Source = palette partagée.
const SAMPLE_LINE_COLOR = getGroupColor(0).hex;

export function DriverPositionsPanel({
  positionsByDriver,
  driverLabels,
  rides,
  driverIdByProfileId,
}: Props): JSX.Element {
  const [now, setNow] = React.useState<Date>(() => new Date());
  // Ligne active (lien liste ↔ carte) : identifiant de la position sélectionnée.
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  // Cible de recentrage — objet NEUF à chaque clic pour rejouer le `flyTo` même
  // sur le même chauffeur (l'effet carte dépend de l'identité de l'objet).
  const [focusTarget, setFocusTarget] = React.useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);

  // Rafraîchir l'âge toutes les 30s — la position ne bouge pas, son âge si.
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const selectDriver = React.useCallback((p: DriverPosition): void => {
    setSelectedId(p.id);
    setFocusTarget({ lat: p.lat, lng: p.lng, zoom: 13 });
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
      // Remplissage = fraîcheur (inchangé) ; liseré = identité (couleur stable).
      tone: positionTone(p.captured_at, now),
      outlineColor: driverColor(p.driver_id).hex,
      selected: selectedId === p.id,
      // Brushing carte → liste : cliquer le marqueur active aussi sa ligne.
      onClick: () => selectDriver(p),
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
        l&apos;âge de la donnée : il ne reflète pas une position « en direct ». Chaque chauffeur a
        une couleur de repère, rappelée dans la liste ci-dessous ; cliquez une ligne pour centrer la
        carte sur lui.
      </p>

      <div className="h-[320px] w-full">
        <Map
          center={REUNION_CENTER}
          zoom={9}
          markers={markers}
          lines={lines}
          focusTarget={focusTarget}
          ariaLabel="Carte 974 : positions des chauffeurs et trajets des courses du jour"
        />
      </div>

      {/* Légende — fidèle 1:1 aux symboles réellement affichés. Hiérarchie :
          chauffeur = repère primaire (disque plus grand, couleur d'identité vive) ;
          trajets = contexte secondaire (marqueurs neutres plus petits, couleur de
          course portée par la ligne seule). Les symboles ne reposent jamais sur la
          couleur seule (formes + libellés). */}
      {(positions.length > 0 || hasTrajectories) && (
        <ul
          className="text-muted-foreground flex flex-wrap items-center gap-x-16 gap-y-4 text-xs"
          aria-label="Légende de la carte"
        >
          {positions.length > 0 && (
            <li className="flex items-center gap-4">
              {/* Disque = position ; le liseré porte la couleur d'identité (varie
                  par chauffeur — l'accent n'est qu'un exemple, la vraie couleur est
                  rappelée dans la liste). */}
              <span
                className="bg-primary outline-accent inline-block h-12 w-12 rounded-full outline outline-2 outline-offset-1"
                aria-hidden
              />
              Chauffeur (disque) — couleur d&apos;identité, rappelée dans la liste
            </li>
          )}
          {hasTrajectories && (
            <>
              <li className="flex items-center gap-4">
                <span className="bg-muted-foreground inline-block h-8 w-8 rounded-sm" aria-hidden />
                Départ (carré)
              </li>
              <li className="flex items-center gap-4">
                <span
                  className="border-muted-foreground inline-block h-8 w-8 rounded-full border-2"
                  aria-hidden
                />
                Arrivée (anneau)
              </li>
              <li className="flex items-center gap-4">
                <span
                  className="inline-block h-[3px] w-16 rounded-full"
                  style={{ backgroundColor: SAMPLE_LINE_COLOR }}
                  aria-hidden
                />
                Trajet — une couleur par course
              </li>
              {/* Lève la confusion du « détour » : les lignes se croisent parce que
                  ce sont des courses distinctes, pas un itinéraire unique. */}
              <li className="text-muted-foreground basis-full">
                Chaque ligne est une course indépendante (domicile → lieu de soins), pas un parcours
                unique. Cliquez un point pour l&apos;identifier ; survolez-le pour voir sa course.
              </li>
            </>
          )}
        </ul>
      )}

      {/* Liste textuelle — équivalent accessible de la carte (clavier + lecteur
          d'écran). Chaque ligne recentre la carte sur le chauffeur et met en
          évidence son marqueur. Pastille = rappel de la couleur d'identité (jamais
          le seul repère : le nom reste primaire, la sélection ajoute anneau + fond). */}
      {positions.length === 0 ? (
        <p className="text-muted-foreground text-base">
          Aucune position connue. Les positions apparaissent au prochain pointage chauffeur.
        </p>
      ) : (
        <ul className="space-y-4" aria-label="Liste des dernières positions">
          {positions.map((p) => {
            const name = driverLabels[p.driver_id] ?? p.driver_id.slice(0, 8);
            const color = driverColor(p.driver_id);
            const isSelected = selectedId === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => selectDriver(p)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex w-full items-center justify-between gap-8 rounded-md px-8 py-4 text-left text-sm transition',
                    'hover:bg-muted focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
                    isSelected && 'bg-muted ring-ring ring-2',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-8">
                    <span
                      className={cn('h-8 w-8 shrink-0 rounded-full', color.dot)}
                      title={`Repère ${color.label}`}
                      aria-hidden
                    />
                    <span className="text-foreground truncate font-medium">{name}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {formatPositionAge(p.captured_at, now)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
