'use client';

import * as React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Map, type MapMarker } from '@/components/map/map.client';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { type DriverPosition, formatPositionAge, positionTone } from '../_lib/use-driver-positions';
import { buildRideTrajectories, COURSE_LINE_NEUTRAL } from '../_lib/ride-map';
import { buildDriverPopupData, renderDriverPopupHtml } from '../_lib/driver-popup';
import { driverColor } from '../_lib/driver-map-link';
import { getGroupColor } from '../optimisation/_lib/group-colors';
import { isRideDone } from '../_lib/ride-order';
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
  /** Ouvre le détail d'une course (RideDrawer) depuis l'aperçu carte (COCKPIT-10). */
  onOpenRide?: (rideId: string) => void;
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
  onOpenRide,
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
  // Grand format (plein écran) — même composant, mêmes interactions ; on ne change
  // que l'enveloppe (tuile ↔ surcouche `fixed inset-0`).
  const [expanded, setExpanded] = React.useState(false);
  // Filtres de couches : masquer/afficher des familles d'objets. Le filtrage agit
  // EN AMONT (sur les données passées à la carte), pas sur des couches internes.
  const [layers, setLayers] = React.useState({ positions: true, trajets: true, terminees: true });
  // Jeton de fermeture d'aperçu : incrémenté à chaque changement de filtre pour que
  // la carte ferme un popup devenu orphelin (marqueur masqué).
  const [dismissPopupToken, setDismissPopupToken] = React.useState(0);

  const toggleLayer = React.useCallback((key: 'positions' | 'trajets' | 'terminees'): void => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
    setDismissPopupToken((t) => t + 1);
  }, []);

  // Rafraîchir l'âge toutes les 30s — la position ne bouge pas, son âge si.
  React.useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Échap ferme le grand format (retour évident, en plus du bouton).
  React.useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded]);

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

  // Filtre « courses terminées » appliqué EN AMONT : on retire les courses
  // terminées de la source avant de construire les trajets (aucun résidu sur la
  // carte, pas seulement estompé).
  const ridesForMap = React.useMemo(
    () => (layers.terminees ? rides : rides.filter((r) => !isRideDone(r))),
    [rides, layers.terminees],
  );

  // Trajets des courses du jour géocodées (départ, arrivée, ligne colorée). Les
  // positions restent affichées : les trajets s'AJOUTENT.
  const { markers: rideMarkers, lines: rideLines } = React.useMemo(
    () => buildRideTrajectories(ridesForMap),
    [ridesForMap],
  );

  // Application des filtres de couches EN AMONT : une famille masquée ne fournit
  // simplement aucun marqueur/ligne à la carte (disparition propre, sans résidu).
  const lines = layers.trajets ? rideLines : [];
  const markers: MapMarker[] = [
    ...(layers.trajets ? rideMarkers : []),
    ...(layers.positions ? positionMarkers : []),
  ];
  const hasTrajectories = lines.length > 0;

  const hasDemo = positions.some((p) => p.source === 'demo');

  return (
    <section
      aria-label="Positions des chauffeurs"
      className={cn(
        'bg-background flex min-h-0 flex-col gap-12 p-16',
        // Grand format = surcouche plein écran ; réduit = tuile du bento.
        expanded ? 'fixed inset-0 z-50' : 'border-border h-full rounded-lg border',
      )}
    >
      <header className="flex items-center justify-between gap-8">
        <h2 className="text-base font-semibold">Carte des chauffeurs</h2>
        {hasDemo && (
          <span
            className="border-border bg-muted text-muted-foreground ml-auto rounded-full border px-8 py-2 text-xs font-medium"
            title="Positions fictives. Aucune vraie position n'est persistée tant que HDS n'est pas en place (DEC-075)."
          >
            DÉMO
          </span>
        )}
      </header>

      <p className="text-muted-foreground text-sm">
        Dernière position connue au pointage, pas un suivi en temps réel.
      </p>

      {/* Filtres de couches — masquer/afficher des familles d'objets. Cases à
          cocher réutilisées (`Checkbox`, clavier + focus). Mêmes filtres en réduit
          et en grand format. */}
      <div
        role="group"
        aria-label="Filtres de la carte"
        className="flex flex-wrap items-center gap-x-16 gap-y-8"
      >
        <span className="text-muted-foreground text-xs font-medium">Afficher :</span>
        <label className="flex cursor-pointer items-center gap-8 text-sm">
          <Checkbox
            checked={layers.positions}
            onChange={() => toggleLayer('positions')}
            aria-label="Afficher les positions des chauffeurs"
          />
          Chauffeurs
        </label>
        <label className="flex cursor-pointer items-center gap-8 text-sm">
          <Checkbox
            checked={layers.trajets}
            onChange={() => toggleLayer('trajets')}
            aria-label="Afficher les trajets des courses"
          />
          Trajets
        </label>
        <label className="flex cursor-pointer items-center gap-8 text-sm">
          <Checkbox
            checked={layers.terminees}
            onChange={() => toggleLayer('terminees')}
            aria-label="Afficher les courses terminées"
          />
          Terminées
        </label>
      </div>

      {/* Carte à hauteur fluide : occupe l'espace restant du panneau (ou de l'écran
          en grand format). Bouton d'agrandissement dans le coin de la carte. */}
      <div className="relative min-h-[280px] w-full flex-1">
        <Map
          center={REUNION_CENTER}
          zoom={9}
          markers={markers}
          lines={lines}
          focusTarget={focusTarget}
          dismissPopupToken={dismissPopupToken}
          onOpenRide={onOpenRide}
          ariaLabel="Carte 974 : positions des chauffeurs et trajets des courses du jour"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Réduire la carte' : 'Agrandir la carte (plein écran)'}
          aria-pressed={expanded}
          className="bg-background/90 border-border text-foreground hover:bg-background focus-visible:ring-ring absolute right-8 top-8 z-[1] inline-flex h-32 w-32 items-center justify-center rounded-md border shadow-sm focus:outline-none focus-visible:ring-2"
        >
          {expanded ? (
            <Minimize2 className="h-16 w-16" aria-hidden />
          ) : (
            <Maximize2 className="h-16 w-16" aria-hidden />
          )}
        </button>
      </div>

      {/* Légende = symbole + étiquette courte (1-3 mots), lisible d'un coup d'œil.
          Le détail vit dans les interactions (popup au clic, mise en évidence au
          survol) et l'intro ci-dessus. Repère non-coloré (forme) conservé. */}
      {((layers.positions && positions.length > 0) || hasTrajectories) && (
        <ul
          className="text-muted-foreground flex flex-wrap items-center gap-x-16 gap-y-4 text-xs"
          aria-label="Légende de la carte"
        >
          {layers.positions && positions.length > 0 && (
            <li className="flex items-center gap-4">
              <span
                className="bg-primary outline-accent inline-block h-12 w-12 rounded-full outline outline-2 outline-offset-1"
                aria-hidden
              />
              Chauffeur (disque)
            </li>
          )}
          {hasTrajectories && (
            <>
              <li className="flex items-center gap-4">
                <span
                  className="inline-flex h-16 w-16 items-center justify-center rounded-sm text-[10px] font-bold leading-none text-white"
                  style={{
                    backgroundColor: SAMPLE_LINE_COLOR,
                    textShadow: '0 1px 2px rgba(0,0,0,0.7)',
                  }}
                  aria-hidden
                >
                  1
                </span>
                Départ (carré, numéroté)
              </li>
              <li className="flex items-center gap-4">
                <span
                  className="inline-block h-8 w-8 rounded-full border-2"
                  style={{ borderColor: SAMPLE_LINE_COLOR }}
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
                Tournée (couleur)
              </li>
              <li className="flex items-center gap-4">
                <span
                  className="inline-block h-[3px] w-16 rounded-full"
                  style={{ backgroundColor: COURSE_LINE_NEUTRAL }}
                  aria-hidden
                />
                Non affectée (gris)
              </li>
              {layers.terminees && (
                <li className="flex items-center gap-4">
                  <span
                    className="bg-muted-foreground inline-block h-8 w-8 rounded-sm"
                    style={{ opacity: 0.45 }}
                    aria-hidden
                  />
                  Terminée (atténué)
                </li>
              )}
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
