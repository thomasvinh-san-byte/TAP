/**
 * Communes officielles INSEE du département 974 (La Réunion).
 *
 * Liste fermée — 24 communes. Source : code officiel géographique INSEE
 * (https://www.insee.fr/fr/information/2560452 — département 974).
 *
 * Utilisée :
 *   - z.enum(VILLES_974) côté Zod (validators/patient.ts adresse)
 *   - Select shadcn côté UI (refus saisie libre, refus typo "Saint Denis"
 *     sans tiret)
 *
 * Refs : PLAN-2 Task 2.1, D-04, DEC-036.
 */

export const VILLES_974 = [
  'Saint-Denis',
  'Saint-Paul',
  'Saint-Pierre',
  'Le Tampon',
  'Saint-André',
  'Saint-Louis',
  'Saint-Benoît',
  'Le Port',
  'Saint-Joseph',
  'Saint-Leu',
  'Sainte-Marie',
  'La Possession',
  'Sainte-Suzanne',
  'Bras-Panon',
  'Petite-Île',
  'Saint-Philippe',
  'Les Avirons',
  "L'Étang-Salé",
  'Cilaos',
  'Salazie',
  'Entre-Deux',
  'La Plaine-des-Palmistes',
  'Sainte-Rose',
  'Trois-Bassins',
] as const;

export type Ville974 = (typeof VILLES_974)[number];

/**
 * Mapping code postal → ville dominante 974.
 *
 * La règle 974 : un CP couvre souvent plusieurs communes (ex : 97435 couvre
 * Saint-Gilles-les-Bains qui dépend administrativement de Saint-Paul). On
 * indique la ville la plus représentative pour l'auto-complétion. La
 * régulatrice peut toujours override via le Select.
 *
 * Liste pragmatique des 12 CP les plus fréquents pour la saisie patient.
 * Compléter si besoin métier émerge.
 */
export const CP_TO_VILLE_DOMINANTE: Readonly<Record<string, Ville974>> =
  Object.freeze({
    '97400': 'Saint-Denis',
    '97410': 'Saint-Pierre',
    '97411': 'Saint-Paul', // Bois-de-Nèfles, commune Saint-Paul
    '97412': 'Bras-Panon',
    '97413': 'Cilaos',
    '97417': 'La Plaine-des-Palmistes',
    '97419': 'La Possession',
    '97420': 'Le Port',
    '97421': "L'Étang-Salé",
    '97422': 'La Possession',
    '97423': 'Le Tampon',
    '97425': 'Les Avirons',
    '97426': 'Trois-Bassins',
    '97427': 'Saint-Leu',
    '97429': 'Petite-Île',
    '97430': 'Le Tampon',
    '97431': 'La Plaine-des-Palmistes',
    '97432': 'Saint-Pierre',
    '97433': 'Salazie',
    '97434': 'Saint-Paul',
    '97435': 'Saint-Paul',
    '97436': 'Saint-Leu',
    '97437': 'Saint-Benoît', // Sainte-Anne, commune Saint-Benoît
    '97438': 'Sainte-Marie',
    '97439': 'Sainte-Rose',
    '97440': 'Saint-André',
    '97441': 'Sainte-Suzanne',
    '97442': 'Saint-Philippe',
    '97450': 'Saint-Louis',
    '97460': 'Saint-Paul',
    '97470': 'Saint-Benoît',
    '97480': 'Saint-Joseph',
    '97490': 'Saint-Denis',
  });

/**
 * Renvoie la ville dominante pour un CP 5 chiffres, null sinon.
 *
 * Tolérant : si le CP n'est pas dans la table, retourne null sans throw.
 * La validation finale du couple CP+Ville reste côté Zod.
 */
export function cpDominantVille(cp: string): Ville974 | null {
  const trimmed = cp.trim();
  if (!/^974[0-9]{2}$/.test(trimmed)) return null;
  return CP_TO_VILLE_DOMINANTE[trimmed] ?? null;
}
