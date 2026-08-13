'use client';

import * as React from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Map, type MapMarker } from '@/components/map/map.client';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { buildRideTrajectories, COURSE_LINE_NEUTRAL, rideIsGeocoded } from '../_lib/ride-map';
import { tourneeColor } from '../_lib/driver-map-link';
import { getGroupColor } from '../optimisation/_lib/group-colors';
import { isRideDone } from '../_lib/ride-order';
import { formatReunionTime } from '../_lib/unassigned-h1';
import type { CockpitRide } from '../_lib/types';

/**
 * Carte des courses du jour (§5.17 bêta, DEC-075).
 *
 * Affiche UNIQUEMENT des données opérationnelles déjà en base : les points de
 * prise en charge / dépose des courses du jour et le tracé pickup→dépose. Ce sont
 * des adresses de courses, PAS un suivi de salarié — aucune position GPS de
 * chauffeur n'est captée, stockée ni suivie (DEC-075 : pas de donnée de santé
 * indirecte avant HDS). Il n'y a donc plus de « position chauffeur » ni de badge
 * « DÉMO » : rien de fictif n'est présenté comme un suivi réel.
 *
 * Réutilise le socle carte existant : `buildRideTrajectories` (marqueurs départ/
 * arrivée + ligne, couleur par tournée), `Map`, et le RideDrawer via `onOpenRide`
 * (COCKPIT-10 — clic sur un point ouvre le détail de la course).
 */

interface Props {
  /** Courses du jour (RLS-filtrées) — source des points et trajets géocodés. */
  rides: CockpitRide[];
  /** Ouvre le détail d'une course (RideDrawer) depuis la carte ou la liste. */
  onOpenRide?: (rideId: string) => void;
}

const REUNION_CENTER = { lat: -21.1, lng: 55.55 };

// Teinte d'exemple pour le trait « trajet » de la légende — une des couleurs de la
// palette de tournées (la couleur réelle varie par tournée). Source = palette partagée.
const SAMPLE_LINE_COLOR = getGroupColor(0).hex;

/** Clé de tournée (chauffeur affecté, sinon véhicule) — même règle que la carte. */
function tourneeKeyOf(r: CockpitRide): string | null {
  return r.driver_id ?? r.vehicle_id ?? null;
}

/** Libellé de tournée pour la liste accessible : nom chauffeur, sinon véhicule. */
function tourneeLabelOf(r: CockpitRide): string {
  if (r.driver_id) return r.driver?.nom_affichage?.trim() || 'Chauffeur';
  if (r.vehicle_id) {
    const imm = r.vehicle?.immatriculation?.trim();
    return imm ? `Véh. ${imm}` : 'Véhicule';
  }
  return 'Non affectée';
}

function patientLabel(r: CockpitRide): string {
  const p = r.patient;
  const name = p ? [p.nom, p.prenom].filter(Boolean).join(' ').trim() : '';
  return name || 'Patient';
}

export function RidesMapPanel({ rides, onOpenRide }: Props): JSX.Element {
  // Course active (lien liste ↔ carte) : ses marqueurs sont mis en évidence.
  const [selectedRideId, setSelectedRideId] = React.useState<string | null>(null);
  // Cible de recentrage — objet NEUF à chaque clic pour rejouer le `flyTo` même
  // sur la même course (l'effet carte dépend de l'identité de l'objet).
  const [focusTarget, setFocusTarget] = React.useState<{
    lat: number;
    lng: number;
    zoom: number;
  } | null>(null);
  // Grand format (plein écran) — même composant, mêmes interactions ; on ne change
  // que l'enveloppe (tuile ↔ surcouche `fixed inset-0`).
  const [expanded, setExpanded] = React.useState(false);
  // Filtre : masquer les courses terminées. Agit EN AMONT (sur la source), pas sur
  // une couche interne — disparition propre, sans résidu sur la carte.
  const [showDone, setShowDone] = React.useState(true);
  // Jeton de fermeture d'aperçu : incrémenté au changement de filtre pour que la
  // carte ferme un popup devenu orphelin (marqueur masqué).
  const [dismissPopupToken, setDismissPopupToken] = React.useState(0);

  const toggleDone = React.useCallback((): void => {
    setShowDone((v) => !v);
    setDismissPopupToken((t) => t + 1);
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

  // Filtre « terminées » appliqué EN AMONT : on retire les courses terminées de la
  // source avant de construire les trajets (aucun résidu, pas seulement estompé).
  const visibleRides = React.useMemo(
    () => (showDone ? rides : rides.filter((r) => !isRideDone(r))),
    [rides, showDone],
  );

  // Trajets des courses géocodées (départ, arrivée, ligne colorée par tournée).
  const { markers: baseMarkers, lines } = React.useMemo(
    () => buildRideTrajectories(visibleRides),
    [visibleRides],
  );

  // Mise en évidence de la course sélectionnée : ses marqueurs passent en `selected`
  // (anneau), sans reconstruire les trajets.
  const markers: MapMarker[] = React.useMemo(
    () =>
      selectedRideId == null
        ? baseMarkers
        : baseMarkers.map((m) => (m.groupId === selectedRideId ? { ...m, selected: true } : m)),
    [baseMarkers, selectedRideId],
  );

  // Liste accessible des courses géocodées (équivalent textuel de la carte). Triée
  // par heure. Les courses sans coordonnées complètes sont comptées à part et
  // signalées, jamais inventées (DEC-075 / honnêteté).
  const geocodedRides = React.useMemo(
    () =>
      visibleRides
        .filter(rideIsGeocoded)
        .slice()
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [visibleRides],
  );
  const ungeocodedCount = visibleRides.length - geocodedRides.length;

  const selectRide = React.useCallback(
    (r: CockpitRide): void => {
      setSelectedRideId(r.id);
      if (typeof r.pickup_lat === 'number' && typeof r.pickup_lng === 'number') {
        setFocusTarget({ lat: r.pickup_lat, lng: r.pickup_lng, zoom: 13 });
      }
      onOpenRide?.(r.id);
    },
    [onOpenRide],
  );

  const hasTrajectories = lines.length > 0;

  return (
    <section
      aria-label="Carte des courses du jour"
      className={cn(
        'bg-background flex min-h-0 flex-col gap-12 p-16',
        // Grand format = surcouche plein écran ; réduit = tuile du bento.
        expanded ? 'fixed inset-0 z-50' : 'border-border h-full rounded-lg border',
      )}
    >
      <header className="flex items-center justify-between gap-8">
        <h2 className="text-base font-semibold">Carte des courses du jour</h2>
      </header>

      <p className="text-muted-foreground text-sm">
        Points de prise en charge et de dépose des courses, et leur trajet. Aucune position de
        chauffeur n&apos;est suivie.
      </p>

      {/* Filtre — masquer/afficher les courses terminées. Case à cocher réutilisée
          (`Checkbox`, clavier + focus). Même filtre en réduit et en grand format. */}
      <div
        role="group"
        aria-label="Filtres de la carte"
        className="flex flex-wrap items-center gap-x-16 gap-y-8"
      >
        <span className="text-muted-foreground text-xs font-medium">Afficher :</span>
        <label className="flex cursor-pointer items-center gap-8 text-sm">
          <Checkbox
            checked={showDone}
            onChange={toggleDone}
            aria-label="Afficher les courses terminées"
          />
          Courses terminées
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
          ariaLabel="Carte 974 : points et trajets des courses du jour"
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
          survol). Repère non-coloré (forme) conservé — la couleur n'est jamais le
          seul signal. */}
      {hasTrajectories && (
        <ul
          className="text-muted-foreground flex flex-wrap items-center gap-x-16 gap-y-4 text-xs"
          aria-label="Légende de la carte"
        >
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
          {showDone && (
            <li className="flex items-center gap-4">
              <span
                className="bg-muted-foreground inline-block h-8 w-8 rounded-sm"
                style={{ opacity: 0.45 }}
                aria-hidden
              />
              Terminée (atténué)
            </li>
          )}
        </ul>
      )}

      {/* Note d'honnêteté : les courses sans adresse géolocalisée ne sont pas sur la
          carte (aucune coordonnée inventée). Elles restent visibles dans « Ma journée ». */}
      {ungeocodedCount > 0 && (
        <p className="text-muted-foreground text-xs">
          {ungeocodedCount} course{ungeocodedCount > 1 ? 's' : ''} sans adresse géolocalisée
          {ungeocodedCount > 1 ? ' ne sont pas affichées' : " n'est pas affichée"} sur la carte.
        </p>
      )}

      {/* Liste textuelle — équivalent accessible de la carte (clavier + lecteur
          d'écran). Chaque ligne recentre la carte sur la prise en charge et ouvre le
          détail de la course. Pastille = rappel de la couleur de tournée (jamais le
          seul repère : patient et heure restent primaires, la sélection ajoute
          anneau + fond). */}
      {geocodedRides.length === 0 ? (
        <p className="text-muted-foreground text-base">
          Aucune course géolocalisée aujourd&apos;hui. Les courses apparaissent ici dès qu&apos;une
          adresse de prise en charge et de dépose est géolocalisée.
        </p>
      ) : (
        <ul className="space-y-4" aria-label="Liste des courses géolocalisées">
          {geocodedRides.map((r) => {
            const who = patientLabel(r);
            const time = formatReunionTime(r.scheduled_at);
            const tourneeKey = tourneeKeyOf(r);
            const done = isRideDone(r);
            const color = tourneeKey && !done ? tourneeColor(tourneeKey) : null;
            const tournee = tourneeLabelOf(r);
            const isSelected = selectedRideId === r.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => selectRide(r)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex w-full items-center justify-between gap-8 rounded-md px-8 py-4 text-left text-sm transition',
                    'hover:bg-muted focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
                    isSelected && 'bg-muted ring-ring ring-2',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-8">
                    <span
                      className={cn(
                        'h-8 w-8 shrink-0 rounded-full',
                        color ? color.dot : 'bg-muted-foreground/50',
                      )}
                      title={color ? `Tournée ${color.label}` : 'Non affectée'}
                      aria-hidden
                    />
                    <span className="text-foreground truncate font-medium">{who}</span>
                    <span className="text-muted-foreground truncate text-xs">{tournee}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {time}
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
