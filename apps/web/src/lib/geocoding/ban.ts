/**
 * Helper geocoding BAN/Géoplateforme — Phase 04.9-quater (#120).
 *
 * Centralise les appels à l'API de géocodage Géoplateforme IGN
 * (`data.geopf.fr/geocodage`). Migration depuis `api-adresse.data.gouv.fr`
 * déprécié 31 Janvier 2026 (headers `Deprecation` + `Sunset` +
 * `x-api-deprecated: true`).
 *
 * Doc officielle 2026 :
 *   - https://geoservices.ign.fr/documentation/services/services-geoplateforme/geocodage
 *   - https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme
 *
 * Shape JSON 100 % identique BAN (FeatureCollection GeoJSON).
 * Paramètres : `q`, `limit`, `autocomplete`, `lat`, `lon` (compatibles).
 * Rate limit : 50 req/s/IP (largement suffisant TAP).
 *
 * Centralisation élimine la duplication identifiée en revue
 * post-Phase 04.9 :
 *   - interface `BanResponse` × 3 fichiers
 *   - constantes `BAN_REUNION_LAT/LON`, `MIN_SCORE`, `REUNION_POSTCODE_PREFIX` × 3
 *   - logique fetch + filter postcode + filter score × 3
 *
 * Refs : CONCERNS migration BAN, ROADMAP Phase 04.9, CLAUDE.md § 11.
 */

/**
 * Centre approximatif La Réunion (Saint-Denis) pour bias de proximité
 * dans l'autocomplete BAN/Géoplateforme.
 */
export const BAN_REUNION_LAT = -21.115;
export const BAN_REUNION_LON = 55.536;

/**
 * Préfixe code postal Réunion (974XX) pour filtrage strict post-fetch.
 * L'API peut remonter des adresses métropole avec label proche.
 */
export const REUNION_POSTCODE_PREFIX = '974';

/**
 * Score plancher BAN — calibration Phase 04.5 UAT Réunion.
 * 0.5 = compromis précision/rappel sur noms de rue 974 (0.4 acceptait
 * trop d'adresses métropole, 0.6 manquait trop d'homonymies).
 */
export const MIN_SCORE = 0.5;

/**
 * Endpoint Géoplateforme IGN (remplace `api-adresse.data.gouv.fr`
 * déprécié 31 Jan 2026). Iso-fonctionnel.
 */
const BAN_ENDPOINT = 'https://data.geopf.fr/geocodage/search';

/**
 * Feature GeoJSON renvoyée par Géoplateforme. Propriétés exhaustives
 * selon doc IGN — les champs `name`, `type`, `id`, `municipality`,
 * `context`, `importance`, `_type`, `x`, `y` sont aussi présents mais
 * non utilisés par TAP V1.5.
 */
export interface BanFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    label: string;
    postcode?: string;
    city?: string;
    citycode?: string;
    score?: number;
  };
}

/**
 * Réponse FeatureCollection Géoplateforme.
 */
export interface BanResponse {
  features: BanFeature[];
}

/**
 * Adresse normalisée pour usage TAP (post filter + map).
 * Coordonnées en format conventionnel [lat, lng] (PAS geoJSON inverse).
 * `citycode` INSEE 5 chiffres requis pour persistence DEC-044
 * threading coords BAN/POI.
 */
export interface BanSuggestion {
  label: string;
  postcode: string;
  city: string;
  citycode: string;
  lat: number;
  lng: number;
  score: number;
}

export interface GeocodeBanOptions {
  /** Limite résultats (défaut 8). Géoplateforme accepte jusqu'à 20. */
  limit?: number;
  /** Mode autocomplete BAN (défaut true). Pondère préfixe. */
  autocomplete?: boolean;
  /** Score minimum pour filtrage post-fetch (défaut `MIN_SCORE` = 0.5). */
  minScore?: number;
  /** Filtre strict préfixe code postal (défaut `'974'`). Passer `''` pour désactiver. */
  postcodePrefix?: string;
}

/**
 * Géocode une chaîne libre vers la BAN/Géoplateforme.
 *
 * Bias de proximité Réunion (lat/lon Saint-Denis) appliqué automatiquement.
 * Filtre strict postcode 974XX + score >= 0.5 post-fetch (configurable via
 * options).
 *
 * Throw si HTTP != 2xx (laisse le caller gérer via React Query retry/error
 * states ou catch silencieux Server Action).
 *
 * @example
 *   const suggestions = await geocodeBanSearch('15 rue stade', { limit: 10 });
 *   // → BanSuggestion[] filtré 974 + score >= 0.5
 */
export async function geocodeBanSearch(
  q: string,
  options: GeocodeBanOptions = {},
): Promise<BanSuggestion[]> {
  const trimmed = q.trim();
  if (trimmed.length < 1) return [];

  const {
    limit = 8,
    autocomplete = true,
    minScore = MIN_SCORE,
    postcodePrefix = REUNION_POSTCODE_PREFIX,
  } = options;

  const url = new URL(BAN_ENDPOINT);
  url.searchParams.set('q', trimmed);
  url.searchParams.set('limit', String(limit));
  if (autocomplete) url.searchParams.set('autocomplete', '1');
  url.searchParams.set('lat', String(BAN_REUNION_LAT));
  url.searchParams.set('lon', String(BAN_REUNION_LON));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Géoplateforme unavailable (HTTP ${res.status})`);
  }

  const json = (await res.json()) as BanResponse;

  return json.features
    .filter((f) =>
      postcodePrefix
        ? f.properties.postcode?.startsWith(postcodePrefix) ?? false
        : true,
    )
    .filter((f) => (f.properties.score ?? 0) >= minScore)
    .map((f) => ({
      label: f.properties.label,
      postcode: f.properties.postcode ?? '',
      city: f.properties.city ?? '',
      citycode: f.properties.citycode ?? '',
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      score: f.properties.score ?? 0,
    }));
}
