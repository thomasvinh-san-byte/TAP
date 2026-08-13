import { STATUS_LABEL } from '../../courses/_components/ride-badges';

/**
 * Habillage d'un bloc-course de la grille par STATUT (Module 5.12 lot A).
 * Réutilise la sémantique de couleur des badges de course (`ride-badges`) —
 * liseré gauche + fond teinté. La couleur n'est JAMAIS le seul repère : le
 * libellé de statut est toujours affiché à côté (accessibilité, WCAG 1.4.1).
 */

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/** Classes du bloc (liseré gauche 4 px + fond teinté) selon la famille de statut. */
export function statusBlockClass(status: string): string {
  if (status === 'assignee') return 'border-l-info bg-info/10';
  if (status === 'en_cours' || status === 'arrive_sur_place' || status === 'patient_a_bord') {
    return 'border-l-warning bg-warning/10';
  }
  if (status === 'terminee') return 'border-l-success bg-success/10';
  if (status.startsWith('annulee')) return 'border-l-destructive bg-destructive/10';
  return 'border-l-muted-foreground bg-muted';
}
