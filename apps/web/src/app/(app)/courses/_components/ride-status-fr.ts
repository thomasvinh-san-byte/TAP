/**
 * Mapping FR humanisé des statuts course (réutilisé par DuplicateBanner et
 * tout autre composant qui affiche un statut côté régulateur).
 *
 * Ton sobre, factuel (NFR-002 / regle-neutralite-et-ton.md). Aucun emoji.
 */
export const STATUS_LABELS_FR: Record<string, string> = {
  validee: 'validée',
  assignee: 'affectée à un chauffeur',
  en_cours: 'en cours',
  terminee: 'terminée',
};

/**
 * Formate une date ISO en heure FR locale (HH:MM, fuseau navigateur).
 * Utilisé pour afficher l'heure d'une course doublon dans le banner.
 */
export function formatHourFR(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
