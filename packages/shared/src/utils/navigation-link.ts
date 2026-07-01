/**
 * Lien de navigation externe — PWA-03 (§5.16).
 *
 * Construit une URL qui ouvre l'application de cartographie du téléphone
 * (Waze / Google Maps / Plans selon l'appareil) plutôt qu'une carte interne —
 * choix délibéré du cahier des charges (économie de batterie).
 *
 * Schéma retenu : l'URL universelle Google Maps `dir/?api=1&destination=…`.
 * Elle fonctionne sur iOS ET Android et déclenche l'ouverture de l'application
 * native de navigation quand elle est installée, sans cibler en dur une seule
 * application propriétaire (le `geo:` seul est limité à Android). Coordonnées
 * privilégiées (plus fiables qu'une adresse texte) ; repli sur l'adresse
 * formatée. Retourne `null` si rien n'est exploitable (pas de bouton mort).
 */

export interface NavDestination {
  lat?: number | null;
  lng?: number | null;
  address?: string | null;
}

const MAPS_BASE = 'https://www.google.com/maps/dir/?api=1&destination=';

export function buildNavigationUrl(dest: NavDestination): string | null {
  const { lat, lng } = dest;
  const hasCoords =
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng);

  if (hasCoords) {
    return `${MAPS_BASE}${lat},${lng}`;
  }

  const address = dest.address?.trim();
  if (address) {
    return `${MAPS_BASE}${encodeURIComponent(address)}`;
  }

  return null;
}
