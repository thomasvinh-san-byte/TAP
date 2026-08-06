/**
 * Dictionnaire « identité de connexion → nom du chauffeur » pour le cockpit.
 *
 * Les positions (`driver_positions.driver_id`) référencent l'identité de
 * CONNEXION du chauffeur (`profiles.id`, = `auth.users.id`), et NON la clé
 * primaire `drivers.id`. Le lien fiche ↔ compte se fait donc par la colonne
 * `drivers.profile_id`. Le dictionnaire est donc indexé par `profile_id`, la
 * même valeur que celle portée par les positions — de sorte que
 * `driverLabels[position.driver_id]` résolve le nom.
 *
 * (Joindre sur `drivers.id` — la clé primaire — ne matcherait jamais : c'est le
 * bug corrigé ici.)
 */

/** Fiche chauffeur minimale nécessaire pour construire le libellé. */
export interface DriverFicheForLabel {
  /** Colonne de liaison vers l'identité de connexion (profiles.id). Nullable. */
  profile_id: string | null;
  nom_affichage: string;
}

/**
 * Construit le dictionnaire `profile_id → nom_affichage`. Les fiches sans
 * `profile_id` (compte non encore rattaché) sont ignorées — aucune position ne
 * peut les référencer de toute façon.
 */
export function buildDriverLabels(drivers: readonly DriverFicheForLabel[]): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const d of drivers) {
    if (d.profile_id) labels[d.profile_id] = d.nom_affichage;
  }
  return labels;
}
