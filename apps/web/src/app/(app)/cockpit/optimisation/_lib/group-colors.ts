/**
 * Palette de couleurs distinctes par groupement (Wave 2 Phase 06.11 — B9).
 *
 * 8 couleurs Tailwind contrastées choisies pour différenciation maximale,
 * y compris pour daltoniens (mélange teintes chaudes / froides / neutres).
 * Au-delà de 8 groupements la palette boucle (modulo) — un cas rare en
 * pratique (~5 groupements/jour côté régulatrice).
 *
 * Chaque couleur est exposée sous deux formes :
 *   - `border` : classe Tailwind `border-l-*` pour la bordure gauche des cards
 *   - `dot`    : classe Tailwind `bg-*` pour la pastille pleine
 *
 * Le `label` est un nom couleur fr accessible (aria-label).
 */

export type GroupColor = {
  readonly name: string;
  readonly border: string;
  readonly dot: string;
  readonly label: string;
};

export const GROUP_COLORS: readonly GroupColor[] = [
  { name: 'blue', border: 'border-l-blue-500', dot: 'bg-blue-500', label: 'Bleu' },
  { name: 'purple', border: 'border-l-purple-500', dot: 'bg-purple-500', label: 'Violet' },
  { name: 'green', border: 'border-l-green-500', dot: 'bg-green-500', label: 'Vert' },
  { name: 'orange', border: 'border-l-orange-500', dot: 'bg-orange-500', label: 'Orange' },
  { name: 'pink', border: 'border-l-pink-500', dot: 'bg-pink-500', label: 'Rose' },
  { name: 'cyan', border: 'border-l-cyan-500', dot: 'bg-cyan-500', label: 'Cyan' },
  { name: 'amber', border: 'border-l-amber-500', dot: 'bg-amber-500', label: 'Ambre' },
  { name: 'indigo', border: 'border-l-indigo-500', dot: 'bg-indigo-500', label: 'Indigo' },
] as const;

/**
 * Renvoie la couleur associée à l'index d'un groupement (modulo palette).
 * Sûr quel que soit l'index — boucle après 8 groupements.
 */
export function getGroupColor(index: number): GroupColor {
  const normalized = ((index % GROUP_COLORS.length) + GROUP_COLORS.length) % GROUP_COLORS.length;
  // `normalized` est borné par `GROUP_COLORS.length`, l'accès est garanti.
  return GROUP_COLORS[normalized] as GroupColor;
}
