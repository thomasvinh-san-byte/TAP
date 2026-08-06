import { getGroupColor, type GroupColor } from '../optimisation/_lib/group-colors';

/**
 * Lien liste ↔ carte du cockpit (COCKPIT-07).
 *
 * Attribue à chaque chauffeur une couleur STABLE de la palette partagée
 * (daltonien-safe, cf. `group-colors`). La couleur est un RAPPEL d'identité :
 * le nom reste le repère principal, la couleur ne fait que renforcer le lien
 * entre une ligne de la liste et son marqueur sur la carte.
 *
 * Stabilité par hachage du `driver_id` : un même chauffeur obtient TOUJOURS la
 * même couleur, quels que soient les autres chauffeurs présents à l'écran
 * (contrairement à un rang par ordre d'arrivée, qui décalerait tout le monde
 * dès qu'un chauffeur apparaît ou disparaît). Au-delà de 8 chauffeurs la
 * palette boucle : deux chauffeurs peuvent partager une couleur — sans ambiguïté
 * car le nom, lui, reste unique et primaire.
 */

/** Hachage déterministe (djb2 simplifié) d'un identifiant en entier positif. */
function hashDriverId(driverId: string): number {
  let hash = 0;
  for (let i = 0; i < driverId.length; i += 1) {
    // `| 0` borne en entier 32 bits signé ; `getGroupColor` normalise ensuite.
    hash = (hash * 31 + driverId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Couleur de repère stable d'un chauffeur (source UNIQUE liste + marqueur).
 * `.dot` (classe Tailwind) pour la pastille de la liste, `.hex` pour le liseré
 * du marqueur MapLibre (canvas, hors classes), `.label` pour l'aria.
 */
export function driverColor(driverId: string): GroupColor {
  return getGroupColor(hashDriverId(driverId));
}
