'use client';

import * as React from 'react';
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
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
  onClick?: () => void;
}

export interface MapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: MapMarker[];
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

export function Map({
  center,
  zoom = 10,
  markers = [],
  className,
  ariaLabel,
}: MapProps): JSX.Element {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<MapLibreMap | null>(null);
  const markersRef = React.useRef<Marker[]>([]);
  const [tileSource, setTileSource] = React.useState<'pmtiles' | 'osm-fallback'>('osm-fallback');

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
    });

    return () => {
      cancelled = true;
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
      el.className = cn(
        'h-16 w-16 rounded-full border-2 border-background shadow-md transition focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
        m.tone === 'muted' ? 'bg-muted-foreground/60' : 'bg-primary',
      );
      if (m.onClick) el.addEventListener('click', m.onClick);
      const marker = new maplibregl.Marker({ element: el }).setLngLat([m.lng, m.lat]).addTo(map);
      markersRef.current.push(marker);
    }
  }, [markers]);

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
