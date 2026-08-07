'use client';

import * as React from 'react';
import maplibregl, {
  type Map as MapLibreMap,
  type Marker,
  type Popup,
  type GeoJSONSource,
} from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/utils';

/**
 * Phase 10.0 prototype géoloc (DEC-096, ADR-012).
 *
 * Carte MapLibre + protocole PMTiles. Source de tuiles offline-friendly,
 * pas d'appel CDN externe en runtime — un extrait `.pmtiles` 974 est
 * servi statiquement depuis `apps/web/public/tiles/reunion.pmtiles`.
 *
 * Si le fichier n'est pas présent (preview sans extract bundlé), la
 * carte s'affiche en fallback OSM standard (raster) pour ne pas casser
 * la démo. Le fallback est explicite via `data-tile-source`.
 *
 * A11y : `role="region"`, `aria-label` parlant. Le rendu carte lui-même
 * (canvas WebGL) n'est pas accessible — un panneau texte de marqueurs
 * (cf. cockpit) doit accompagner la carte pour la régulatrice qui
 * naviguerait au clavier.
 */

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  /** Couleur tokens 06.14 : 'primary' (frais), 'muted' (ancien). */
  tone?: 'primary' | 'muted';
  /**
   * Couleur CSS de REMPLISSAGE du marqueur, prioritaire sur `tone` : hex de
   * palette (`#rrggbb`) ou jeton de thème (`hsl(var(--muted-foreground))` pour
   * les marqueurs neutres en appui). Appliquée en style direct (DOM), donc toute
   * couleur CSS est acceptée. La couleur n'est jamais le seul signal — cf. `shape`.
   */
  color?: string;
  /**
   * Forme du marqueur, pour distinguer sans la couleur :
   *   - `dot`   : disque plein (défaut ; positions chauffeurs)
   *   - `start` : carré plein (départ d'une course)
   *   - `end`   : anneau creux (arrivée d'une course)
   */
  shape?: 'dot' | 'start' | 'end';
  /**
   * Liseré `#rrggbb` posé en OUTLINE, distinct du remplissage (`tone`/`color`).
   * Sert de rappel d'identité (couleur stable par chauffeur) sans écraser
   * l'information de fraîcheur portée par le remplissage. Jamais le seul repère :
   * le nom reste primaire, et la sélection ci-dessous ajoute un signal de taille.
   */
  outlineColor?: string;
  /**
   * Marqueur sélectionné (ligne active de la liste). Mise en évidence par un
   * halo et un liseré renforcé — un signal de PROÉMINENCE, pas seulement de
   * couleur.
   */
  selected?: boolean;
  /**
   * Texte court affiché AU CENTRE du marqueur (ex. numéro d'ordre de passage).
   * Contraste fort (texte clair + ombre portée) pour rester lisible sur toute
   * couleur vive. Élargit légèrement le marqueur pour rester lisible.
   */
  badge?: string;
  /**
   * Marqueur estompé (ex. course terminée) : opacité réduite, gardé visible pour
   * le contexte. L'atténuation n'est pas le seul repère — cf. `badge`/`shape`.
   */
  faded?: boolean;
  /**
   * Contenu HTML d'un aperçu ouvert au clic (popup native MapLibre). Un seul
   * popup à la fois ; fermeture au clic extérieur, au bouton et à Échap.
   */
  popupHtml?: string;
  /**
   * Identifiant du groupe (ex. course) auquel appartient le marqueur, égal à
   * l'`id` de la `MapLine` correspondante. Au survol / focus du marqueur, la ligne
   * de ce groupe est mise en évidence (feature-state) — relie visuellement un
   * départ à son arrivée, sans libellé permanent.
   */
  groupId?: string;
  onClick?: () => void;
}

/** Segment droit départ→arrivée (pas de routage réel : souverain, hors-ligne). */
export interface MapLine {
  id: string;
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  /** Couleur `#rrggbb` du trait. */
  color: string;
  label?: string;
  /** Trajet estompé (course terminée) : opacité réduite, gardé visible. */
  muted?: boolean;
}

export interface MapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  /** Trajets (segments) à tracer, en plus des marqueurs. Rétro-compat : optionnel. */
  lines?: MapLine[];
  /**
   * Cible de recentrage dynamique (survient APRÈS l'init). Un nouvel objet
   * déclenche un `flyTo` doux. `null`/absent : aucun recentrage. Respecte
   * `prefers-reduced-motion` (pas de `essential:true`) → saut immédiat si l'OS
   * demande de réduire les animations.
   */
  focusTarget?: { lat: number; lng: number; zoom?: number } | null;
  /**
   * Jeton de fermeture d'aperçu : à chaque changement de valeur, la popup ouverte
   * est fermée. Sert à éviter un popup ORPHELIN quand l'appelant masque une famille
   * d'objets (filtre de couches) dont un marqueur avait un popup ouvert.
   */
  dismissPopupToken?: number;
  className?: string;
  ariaLabel: string;
}

const PMTILES_URL = '/tiles/reunion.pmtiles';
const FALLBACK_OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

let protocolRegistered = false;
function ensureProtocol(): void {
  if (protocolRegistered) return;
  const protocol = new Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  protocolRegistered = true;
}

async function detectPmtilesAvailable(): Promise<boolean> {
  try {
    const res = await fetch(PMTILES_URL, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

const RIDE_LINES_SOURCE = 'ride-lines';
const RIDE_LINES_HALO_LAYER = 'ride-lines-halo';
const RIDE_LINES_LAYER = 'ride-lines-line';

function linesToGeoJSON(lines: MapLine[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: lines.map((l) => ({
      type: 'Feature',
      // `rideId` sert d'identifiant de feature (via `promoteId`) pour piloter le
      // feature-state de mise en évidence depuis le survol d'un marqueur.
      properties: { color: l.color, rideId: l.id, muted: l.muted ?? false },
      geometry: {
        type: 'LineString',
        coordinates: [
          [l.from.lng, l.from.lat],
          [l.to.lng, l.to.lat],
        ],
      },
    })),
  };
}

export function Map({
  center,
  zoom = 10,
  markers = [],
  lines = [],
  focusTarget = null,
  dismissPopupToken,
  className,
  ariaLabel,
}: MapProps): JSX.Element {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const markersRef = React.useRef<Marker[]>([]);
  // Un SEUL aperçu à la fois : ouvrir un nouveau popup ferme le précédent.
  const popupRef = React.useRef<Popup | null>(null);
  const [tileSource, setTileSource] = React.useState<'pmtiles' | 'osm-fallback'>('osm-fallback');
  // Vrai une fois le style chargé — les couches (lignes) ne peuvent être ajoutées
  // qu'après `load`. Sert aussi à (re)poser marqueurs et lignes de façon fiable.
  const [mapReady, setMapReady] = React.useState(false);

  // Ouvre un aperçu au niveau du marqueur, décalé pour ne pas le cacher. La
  // popup native MapLibre gère focus, bouton de fermeture et fermeture au clic
  // extérieur (`closeOnClick`). Échap est géré ci-dessous.
  const openPopup = React.useCallback((lngLat: [number, number], html: string) => {
    const map = mapRef.current;
    if (!map) return;
    popupRef.current?.remove();
    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      focusAfterOpen: true,
      offset: 16,
      maxWidth: '260px',
      className: 'cockpit-map-popup',
    })
      .setLngLat(lngLat)
      .setHTML(html)
      .addTo(map);
    popup.on('close', () => {
      if (popupRef.current === popup) popupRef.current = null;
    });
    popupRef.current = popup;
  }, []);

  // Met en évidence (ou éteint) la ligne d'une course via feature-state. Sûr si la
  // source n'existe pas encore (aucune ligne) : on ne fait rien.
  const setLineHighlight = React.useCallback((rideId: string, on: boolean) => {
    const map = mapRef.current;
    if (!map || !map.getSource(RIDE_LINES_SOURCE)) return;
    map.setFeatureState({ source: RIDE_LINES_SOURCE, id: rideId }, { highlight: on });
  }, []);

  // Ferme l'aperçu ouvert quand l'appelant le demande (changement de couche/filtre)
  // — évite un popup orphelin resté sur un marqueur désormais masqué.
  React.useEffect(() => {
    popupRef.current?.remove();
  }, [dismissPopupToken]);

  // Fermeture clavier (Échap) — complète `closeOnClick` de la popup native.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') popupRef.current?.remove();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Suivi de la taille du CONTENEUR (pas seulement de la fenêtre) : quand la carte
  // passe en plein écran (ou change de tuile), MapLibre ne se redimensionne pas
  // tout seul sur un simple changement de conteneur → on force `resize()`.
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => mapRef.current?.resize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    ensureProtocol();

    let cancelled = false;
    void detectPmtilesAvailable().then((available) => {
      if (cancelled || !el) return;

      const source = available ? 'pmtiles' : 'osm-fallback';
      setTileSource(source);

      const map = new maplibregl.Map({
        container: el,
        center: [center.lng, center.lat],
        zoom,
        style: {
          version: 8,
          glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
          sources:
            source === 'pmtiles'
              ? {
                  reunion: {
                    type: 'vector',
                    url: `pmtiles://${PMTILES_URL}`,
                  },
                }
              : {
                  osm: {
                    type: 'raster',
                    tiles: [FALLBACK_OSM_TILES],
                    tileSize: 256,
                    attribution: '© OpenStreetMap contributors',
                  },
                },
          // Fond vectoriel ÉPURÉ (schéma Protomaps basemaps, cohérent avec les
          // glyphs) : couches utiles seulement (eau, routes, limites) et SURTOUT
          // AUCUNE couche `places` — les libellés / gros points de communes
          // masqueraient marqueurs et trajets. Couleurs via jetons de thème
          // (jour/nuit), même convention que le fond existant. Rendu effectif
          // une fois l'extrait de tuiles 974 en place ; sinon la carte reste sur
          // son repli OSM raster (inchangé). Un source-layer absent des tuiles
          // ne rend simplement rien — pas d'erreur.
          layers:
            source === 'pmtiles'
              ? [
                  {
                    id: 'background',
                    type: 'background',
                    paint: { 'background-color': 'hsl(var(--muted))' },
                  },
                  {
                    id: 'water',
                    type: 'fill',
                    source: 'reunion',
                    'source-layer': 'water',
                    paint: {
                      'fill-color': 'hsl(var(--muted-foreground))',
                      'fill-opacity': 0.12,
                    },
                  },
                  {
                    id: 'roads',
                    type: 'line',
                    source: 'reunion',
                    'source-layer': 'roads',
                    layout: { 'line-cap': 'round', 'line-join': 'round' },
                    paint: { 'line-color': 'hsl(var(--border))', 'line-width': 1 },
                  },
                  {
                    id: 'boundaries',
                    type: 'line',
                    source: 'reunion',
                    'source-layer': 'boundaries',
                    paint: {
                      'line-color': 'hsl(var(--muted-foreground))',
                      'line-opacity': 0.4,
                      'line-width': 1,
                      'line-dasharray': [2, 2],
                    },
                  },
                ]
              : [
                  {
                    id: 'osm',
                    type: 'raster',
                    source: 'osm',
                  },
                ],
        },
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on('load', () => {
        if (!cancelled) setMapReady(true);
      });
    });

    return () => {
      cancelled = true;
      setMapReady(false);
      popupRef.current?.remove();
      popupRef.current = null;
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // intentionally only run once — center/zoom are initial values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render markers when the list changes.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    // Reconstruire les marqueurs remplace leurs éléments DOM : un `mouseleave`
    // peut ne jamais arriver. On repart donc d'un feature-state propre (aucune
    // ligne « collée » en surbrillance) avant de recâbler le survol.
    if (map.getSource(RIDE_LINES_SOURCE)) map.removeFeatureState({ source: RIDE_LINES_SOURCE });

    for (const m of markers) {
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', m.label);
      el.title = m.label;
      const shape = m.shape ?? 'dot';
      // Bordure / ombre / anneau de focus / couleur `tone` par classes. La
      // TAILLE, la FORME et le curseur sont posés en STYLE DIRECT : les classes
      // de taille (`h-*`/`w-*`) ne priment pas de façon fiable sur l'élément de
      // marqueur MapLibre, ce qui réduisait les marqueurs à quelques pixels
      // (donc impossibles à cliquer). Même approche que couleur/bordure.
      el.className = cn(
        'border-2 border-background shadow-md transition focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        // Défaut `tone` (positions chauffeurs) — inchangé quand aucune couleur.
        !m.color && (m.tone === 'muted' ? 'bg-muted-foreground/60' : 'bg-primary'),
      );
      // Hiérarchie visuelle : la position chauffeur (repère PRIMAIRE de « la carte
      // des chauffeurs ») est nettement plus grande et cliquable ; les marqueurs
      // de course (départ/arrivée) sont SECONDAIRES — petits, en appui, pour ne pas
      // dominer ni se chevaucher. Taille en style direct (les classes `h-*`/`w-*`
      // ne priment pas de façon fiable sur l'élément de marqueur MapLibre).
      // Un marqueur portant un numéro (départ) est un peu plus grand pour rester
      // lisible, tout en restant ≤ la position chauffeur (hiérarchie préservée).
      const sizePx = shape === 'dot' ? 24 : m.badge ? 20 : 14;
      el.style.width = `${sizePx}px`;
      el.style.height = `${sizePx}px`;
      el.style.boxSizing = 'border-box';
      el.style.padding = '0';
      // Empilement : la position chauffeur reste AU-DESSUS des marqueurs de course
      // (contexte) quand ils se superposent. La sélection passe encore au-dessus.
      el.style.zIndex = shape === 'dot' ? '2' : '1';
      // Formes distinctes (l'info passe sans la couleur seule) : disque
      // (position / arrivée) vs carré arrondi (départ). Border-radius en direct
      // pour la même raison de fiabilité que la taille.
      el.style.borderRadius = shape === 'start' ? '4px' : '9999px';
      // Curseur « main » seulement pour les marqueurs interactifs (chauffeurs) —
      // les marqueurs départ/arrivée ne portent pas d'action.
      if (m.onClick || m.popupHtml) el.style.cursor = 'pointer';
      if (m.color) {
        if (shape === 'end') {
          // Anneau creux : centre au fond de la carte, bord épais coloré.
          el.style.backgroundColor = 'hsl(var(--background))';
          el.style.borderColor = m.color;
          el.style.borderWidth = '3px';
        } else {
          el.style.backgroundColor = m.color;
        }
      }
      // Liseré d'identité (couleur stable par chauffeur) en OUTLINE : hors du
      // liseré blanc et du remplissage `tone`, donc n'écrase pas la fraîcheur.
      // L'inline prime même sur `focus-visible:outline-none` → reste visible au
      // focus clavier, en plus de l'anneau de focus (box-shadow, autre propriété).
      if (m.outlineColor) {
        el.style.outlineStyle = 'solid';
        el.style.outlineColor = m.outlineColor;
        el.style.outlineWidth = m.selected ? '3px' : '2px';
        el.style.outlineOffset = m.selected ? '2px' : '1px';
      }
      // Sélection = proéminence (halo + z-index), pas seulement une teinte. Le
      // halo (box-shadow) remplace l'ombre `shadow-md` le temps de la sélection.
      if (m.selected) {
        el.style.boxShadow = '0 0 0 4px hsl(var(--ring) / 0.35)';
        el.style.zIndex = '10';
      }
      // Numéro d'ordre centré : texte clair + ombre portée pour rester lisible sur
      // toute couleur vive (l'ombre garantit le contraste sans calcul de luminance).
      if (m.badge) {
        el.textContent = m.badge;
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = '#ffffff';
        el.style.fontSize = '11px';
        el.style.fontWeight = '700';
        el.style.lineHeight = '1';
        el.style.textShadow = '0 1px 2px rgba(0,0,0,0.7)';
      }
      // Estompage (course terminée) : opacité réduite, gardé visible pour le
      // contexte. Signal cumulé à la neutralisation de couleur (jamais seul).
      if (m.faded) el.style.opacity = '0.45';
      if (m.onClick) el.addEventListener('click', m.onClick);
      if (m.popupHtml) {
        const html = m.popupHtml;
        const lngLat: [number, number] = [m.lng, m.lat];
        el.addEventListener('click', () => openPopup(lngLat, html));
      }
      // Relier départ ↔ arrivée : survol/focus d'un point → sa ligne ressort.
      // Focus/blur couvrent le clavier et le tactile (le tap donne le focus).
      if (m.groupId) {
        const gid = m.groupId;
        const on = (): void => setLineHighlight(gid, true);
        const off = (): void => setLineHighlight(gid, false);
        el.addEventListener('mouseenter', on);
        el.addEventListener('mouseleave', off);
        el.addEventListener('focus', on);
        el.addEventListener('blur', off);
      }
      const marker = new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map);
      markersRef.current.push(marker);
    }
  }, [markers, mapReady, openPopup, setLineHighlight]);

  // Trace les lignes (trajets) via une source GeoJSON + un liseré blanc (halo)
  // sous un trait coloré. Nécessite le style chargé (`mapReady`).
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const data = linesToGeoJSON(lines);
    const existing = map.getSource(RIDE_LINES_SOURCE) as GeoJSONSource | undefined;
    if (existing) {
      existing.setData(data);
      return;
    }
    // `promoteId` : la propriété `rideId` devient l'id de feature, ce qui permet de
    // cibler une ligne par `setFeatureState` (mise en évidence au survol/focus d'un
    // point de la course).
    map.addSource(RIDE_LINES_SOURCE, { type: 'geojson', data, promoteId: 'rideId' });
    // Trajets = CONTEXTE (secondaire) : trait fin et légèrement transparent, halo
    // discret. La couleur par course reste PORTÉE PAR LA LIGNE (seul support de la
    // teinte vive de course) — les marqueurs départ/arrivée, eux, sont neutres —
    // pour ne pas rivaliser avec la couleur d'identité chauffeur (repère primaire).
    // Au survol d'un point de la course, `highlight` (feature-state) épaissit et
    // opacifie SA ligne : on relie ainsi un départ à son arrivée, sans surcharge.
    // Estompage des courses terminées (`muted`) : opacité fortement réduite, mais
    // gardées visibles (« c'est fait »). La surbrillance au survol prime.
    map.addLayer({
      id: RIDE_LINES_HALO_LAYER,
      type: 'line',
      source: RIDE_LINES_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': ['case', ['boolean', ['feature-state', 'highlight'], false], 7, 4],
        'line-opacity': [
          'case',
          ['boolean', ['feature-state', 'highlight'], false],
          0.85,
          ['boolean', ['get', 'muted'], false],
          0.25,
          0.7,
        ],
      },
    });
    map.addLayer({
      id: RIDE_LINES_LAYER,
      type: 'line',
      source: RIDE_LINES_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': ['case', ['boolean', ['feature-state', 'highlight'], false], 4, 2],
        'line-opacity': [
          'case',
          ['boolean', ['feature-state', 'highlight'], false],
          1,
          ['boolean', ['get', 'muted'], false],
          0.3,
          0.75,
        ],
      },
    });
  }, [lines, mapReady]);

  // Recentrage dynamique doux sur une cible (clic sur une ligne de la liste).
  // Un nouvel objet `focusTarget` (identité) relance un `flyTo` — recentrer sur
  // le MÊME chauffeur au clic répété fonctionne donc si l'appelant passe un objet
  // neuf. `essential` non posé → `prefers-reduced-motion` respecté (saut immédiat).
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusTarget) return;
    map.flyTo({
      center: [focusTarget.lng, focusTarget.lat],
      zoom: focusTarget.zoom ?? map.getZoom(),
      duration: 700,
    });
  }, [focusTarget, mapReady]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={ariaLabel}
      data-tile-source={tileSource}
      className={cn(
        'border-border bg-muted relative h-full w-full overflow-hidden rounded-md border',
        className,
      )}
    />
  );
}
