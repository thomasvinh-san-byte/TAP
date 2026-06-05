# ADR-012 — MapLibre GL + PMTiles pour le rendu carte (Phase 10.0)

- **Statut** : Accepté
- **Date** : 2026-06-05
- **Affecte** : `apps/web/src/components/map/`, dépendances npm, Phase 10.0, Phase 10

## Contexte

La Phase 10.0 (prototype géoloc) introduit un panneau carte dans le cockpit régulateur pour afficher la dernière position connue de chaque chauffeur. Pour la première fois, le projet a besoin d'un rendu cartographique.

Trois contraintes structurantes :

1. **Pas d'API tierce payante**. Mapbox, Google Maps : exclus (modèle économique projet). On reste sur du libre.
2. **PWA chauffeur déjà offline-first**. La cible naturelle est un fond de carte servi en static depuis `public/` ou un asset bundlé, pas une CDN externe à laquelle on ne peut faire confiance pour la disponibilité.
3. **Volume contrôlé**. On affiche un seul bbox (974), pas d'usage commercial. Le moteur de tuiles doit servir cet extrait sans infrastructure dédiée.

## Décision

**MapLibre GL JS** (`maplibre-gl`, dernier `^4.7.0`) pour le rendu carte. Vector + raster, WebGL, fork OSS de Mapbox GL antérieur au passage propriétaire de Mapbox.

**PMTiles** (`pmtiles`, dernier `^3.2.0`) pour servir les tuiles vectorielles. Format de fichier auto-portant lisible par MapLibre via un protocole client-side (`maplibregl.addProtocol('pmtiles', protocol.tile)`). L'extrait `.pmtiles` 974 est servi statique depuis `apps/web/public/tiles/reunion.pmtiles` — pas de serveur de tuiles, pas d'API.

**Fallback OSM raster** : si le fichier `.pmtiles` est absent du déploiement (preview minimale), la carte bascule transparently sur les tuiles OSM raster standard avec attribution. Le composant expose `data-tile-source` pour debug.

**Fonts/sprites** : `protomaps/basemaps` via CDN (`protomaps.github.io/basemaps-assets/`). Pas de regénération locale (RETEX : ce point sous-estimé fait perdre du temps).

## Conséquences

### Positives

- **Zéro coût marginal** : pas de tier, pas de quota, pas de surveillance d'API key.
- **Offline-friendly** : l'extrait `.pmtiles` peut être servi par le SW Serwist (Phase 04.9), précaché pour `/cockpit`.
- **Indépendance fournisseur** : MapLibre + PMTiles sont des standards OSS multi-maintainers.
- **A11y** : carte = `role="region"` + `aria-label` + liste texte accompagnante (cockpit) — pattern recommandé MDN.

### Négatives / dette

- **Extrait `.pmtiles` à fabriquer** : utiliser `tilemaker` ou télécharger un extrait Geofabrik 974 + `pmtiles convert`. Procédure documentée à inscrire dans `docs/operations/` à la première vraie démo terrain.
- **Taille du fichier** : viser 20-60 Mo pour zoom raisonnable (8-14). À mesurer avant commit (ne PAS ajouter > 100 Mo binaire dans git — utiliser CDN ou release artefact).
- **CDN fonts** : `protomaps.github.io` est un point unique de défaillance. Mitigation : bundler les glyphs `pbf` dans `public/` ultérieurement si SLA insuffisant.
- **2 nouvelles dépendances** : `maplibre-gl` (~2 Mo gzipped) + `pmtiles` (~30 ko). Compatibles avec la cible bundle PWA.

## Alternatives évaluées

| Option | Score | Pourquoi rejetée |
|---|---|---|
| Leaflet + raster OSM | 7 | Plus simple mais pas de vector tiles → pas de theming jour/nuit propre via tokens |
| Mapbox GL JS | 9 | License propriétaire post-v2 + facturation API |
| OpenLayers | 7 | Moins de momentum communauté que MapLibre |
| `react-map-gl` wrapper | 6 | Couche d'abstraction supplémentaire pour peu de valeur |

## Procédure de génération de l'extrait `.pmtiles`

(À documenter à la première démo terrain — Phase 10.0 V1 utilise le fallback OSM par défaut.)

```bash
# 1. Télécharger extrait Geofabrik 974
curl -O https://download.geofabrik.de/africa/reunion-latest.osm.pbf

# 2. Convertir avec tilemaker (config standard openmaptiles)
tilemaker --input reunion-latest.osm.pbf \
  --output reunion.mbtiles \
  --config resources/config-openmaptiles.json \
  --process resources/process-openmaptiles.lua

# 3. Convertir mbtiles → pmtiles
pmtiles convert reunion.mbtiles reunion.pmtiles

# 4. Placer dans public/tiles/
mv reunion.pmtiles apps/web/public/tiles/reunion.pmtiles
```
