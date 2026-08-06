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
   * Couleur `#rrggbb` explicite (ex. palette de courses). Prioritaire sur `tone`.
   * La couleur n'est jamais le seul signal — cf. `shape`.
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
   * Contenu HTML d'un aperçu ouvert au clic (popup native MapLibre). Un seul
   * popup à la fois ; fermeture au clic extérieur, au bouton et à Échap.
   */
  popupHtml?: string;
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
}

export interface MapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
  /** Trajets (segments) à tracer, en plus des marqueurs. Rétro-compat : optionnel. */
  lines?: MapLine[];
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
      properties: { color: l.color },
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

  // Fermeture clavier (Échap) — complète `closeOnClick` de la popup native.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') popupRef.current?.remove();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
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
          layers:
            source === 'pmtiles'
              ? [
                  {
                    id: 'background',
                    type: 'background',
                    paint: { 'background-color': 'hsl(var(--muted))' },
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

    for (const m of markers) {
      const el = document.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', m.label);
      el.title = m.label;
      const shape = m.shape ?? 'dot';
      // Formes distinctes (l'info passe sans la couleur seule) : disque plein
      // (position), carré plein (départ), anneau creux (arrivée).
      const shapeCls =
        shape === 'start'
          ? 'h-12 w-12 rounded-sm'
          : shape === 'end'
            ? 'h-12 w-12 rounded-full'
            : 'h-16 w-16 rounded-full';
      el.className = cn(
        'border-2 border-background shadow-md transition focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        shapeCls,
        // Défaut `tone` (positions chauffeurs) — inchangé quand aucune couleur.
        !m.color && (m.tone === 'muted' ? 'bg-muted-foreground/60' : 'bg-primary'),
      );
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
      if (m.onClick) el.addEventListener('click', m.onClick);
      if (m.popupHtml) {
        const html = m.popupHtml;
        const lngLat: [number, number] = [m.lng, m.lat];
        el.addEventListener('click', () => openPopup(lngLat, html));
      }
      const marker = new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map);
      markersRef.current.push(marker);
    }
  }, [markers, mapReady, openPopup]);

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
    map.addSource(RIDE_LINES_SOURCE, { type: 'geojson', data });
    map.addLayer({
      id: RIDE_LINES_HALO_LAYER,
      type: 'line',
      source: RIDE_LINES_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 6, 'line-opacity': 0.85 },
    });
    map.addLayer({
      id: RIDE_LINES_LAYER,
      type: 'line',
      source: RIDE_LINES_SOURCE,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 3 },
    });
  }, [lines, mapReady]);

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
