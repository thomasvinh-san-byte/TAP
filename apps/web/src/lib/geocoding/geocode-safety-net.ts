/**
 * Filet serveur de géocodage — DEC-094 Phase 06.19.
 *
 * Réutilisable depuis les Server Actions qui persistent une course ou
 * un template de récurrence : si le picker n'a pas remonté de coords
 * mais qu'une adresse est saisie, tente un `geocodeBanSearch` (1 résultat).
 *
 * Non bloquant : si BAN indisponible ou aucun match, renvoie `null`
 * partout — la course est créée quand même mais sera exclue de
 * `solveLocal` (06.12) jusqu'au backfill ou retry manuel via
 * `/admin/maintenance`.
 *
 * Idempotent : si coords déjà fournies (lat ET lng), court-circuit
 * (jamais d'appel réseau redondant).
 */

import { geocodeBanSearch } from '@/lib/geocoding/ban';

export type GeocodeCoords = {
  lat: number | null;
  lng: number | null;
  citycode: string | null;
};

export async function geocodeIfMissing(
  address: string | undefined | null,
  lat: number | null | undefined,
  lng: number | null | undefined,
  citycode: string | null | undefined,
): Promise<GeocodeCoords> {
  if (lat != null && lng != null) {
    return { lat, lng, citycode: citycode ?? null };
  }
  if (!address || address.trim().length < 3) {
    return { lat: null, lng: null, citycode: null };
  }
  try {
    const results = await geocodeBanSearch(address, { limit: 1 });
    const f = results[0];
    if (!f) return { lat: null, lng: null, citycode: null };
    return { lat: f.lat, lng: f.lng, citycode: f.citycode || null };
  } catch {
    return { lat: null, lng: null, citycode: null };
  }
}
