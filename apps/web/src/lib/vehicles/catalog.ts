/**
 * Catalogue Marque → Modèles fréquents du parc TAP (Phase 06.17 D-05).
 *
 * Source de vérité pour les comboboxes Marque/Modèle dépendantes du
 * formulaire véhicule. Couvre les marques les plus présentes sur le
 * parc français (priorité Renault/Peugeot/Citroën — parc utilitaire FR),
 * étendu aux constructeurs courants 974.
 *
 * **Non exhaustif** : la saisie reste libre côté UI (`allowFreeText`).
 * Le catalogue accélère la saisie pour les cas fréquents sans bloquer
 * les modèles rares ou anciens. Maintenu à la main, versionné, zéro
 * appel API tiers (DEC-003 : pas de dépendance externe ajoutée).
 *
 * Ordre des marques : par fréquence présumée sur le parc taxi/VSL/TPMR
 * en France métropolitaine et 974. Les modèles dans chaque marque
 * suivent l'ordre alphabétique pour faciliter le scan visuel.
 */

export const VEHICLE_CATALOG: Record<string, readonly string[]> = {
  Renault: ['Clio', 'Express', 'Kangoo', 'Master', 'Mégane', 'Scénic', 'Trafic', 'Twingo'],
  Peugeot: [
    '208',
    '308',
    '508',
    '2008',
    '3008',
    'Boxer',
    'Expert',
    'Partner',
    'Rifter',
    'Traveller',
  ],
  Citroën: ['Berlingo', 'C3', 'C4', 'Jumper', 'Jumpy', 'SpaceTourer'],
  Dacia: ['Dokker', 'Duster', 'Lodgy', 'Logan', 'Sandero'],
  'Mercedes-Benz': ['Citan', 'Sprinter', 'Vito', 'Classe V'],
  Volkswagen: ['Caddy', 'Caravelle', 'Crafter', 'Multivan', 'Transporter'],
  Ford: ['Connect', 'Custom', 'Tourneo', 'Transit'],
  Toyota: ['Proace', 'Proace Verso', 'Yaris'],
  Opel: ['Combo', 'Movano', 'Vivaro', 'Zafira'],
  Fiat: ['Doblo', 'Ducato', 'Scudo', 'Talento'],
  Nissan: ['NV200', 'NV300', 'NV400', 'Primastar'],
  Hyundai: ['H1', 'i30', 'Staria'],
  Kia: ['Ceed', 'Carnival'],
};

export type VehicleBrand = keyof typeof VEHICLE_CATALOG;

/** Liste des marques connues du catalogue, dans l'ordre fourni. */
export const VEHICLE_BRANDS: readonly string[] = Object.keys(VEHICLE_CATALOG);

/**
 * Renvoie les modèles connus pour une marque. Cas marque inconnue ou
 * saisie libre → tableau vide (la combobox modèle reste alors en
 * saisie libre).
 */
export function modelsForBrand(brand: string): readonly string[] {
  return VEHICLE_CATALOG[brand] ?? [];
}

/**
 * Normalisation des saisies libres au submit (D-07) : trim + Title Case
 * sur le premier mot. Évite les doublons de casse (« renault » →
 * « Renault ») sans bloquer les variantes inhabituelles.
 */
export function normalizeBrandOrModel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  // Préserver les acronymes (BMW, VW, MPV) — si toute la chaîne est en
  // majuscules, ne pas re-caser. Sinon Title Case sur les mots.
  if (trimmed === trimmed.toUpperCase() && /^[A-Z0-9\s-]+$/.test(trimmed)) {
    return trimmed;
  }
  return trimmed
    .split(/(\s+|-)/)
    .map((part) => {
      if (/^\s+$|^-$/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join('');
}
