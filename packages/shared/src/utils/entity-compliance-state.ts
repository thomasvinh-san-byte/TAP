/**
 * Helpers purs — état de conformité d'une ENTITÉ (Phase 06.35, DEC-114).
 *
 * Agrège plusieurs échéances (`compliance_items`) d'un chauffeur ou
 * véhicule en un état unique exploitable par le contrôle de
 * planification (assign-modal + optimiseur).
 *
 * Module pur — testable Vitest, partagé serveur (assignRideAction,
 * route optimizer) et client (assign-modal badge). Réutilise
 * `complianceStatus` (lot 1) — 0 logique neuve.
 */

import { complianceStatus, type ComplianceStatus } from './compliance-status';

/** Item minimal consommé par l'agrégateur. */
export interface EntityComplianceInput {
  expires_at: string | null;
}

export interface EntityComplianceState {
  /** Au moins une échéance expirée. */
  hasExpired: boolean;
  /** Au moins une échéance ≤ 90 jours (sans inclure les expirées). */
  hasSoon: boolean;
  /** Pire statut observé : 'expired' > 'soon' > 'ok'. */
  worstStatus: ComplianceStatus;
}

/**
 * Calcule l'état agrégé d'une entité à partir de ses items
 * `compliance_items` (déjà filtrés archive=false).
 *
 * Items sans `expires_at` (null) sont ignorés : pas d'expiration =
 * pas de contrainte.
 */
export function entityComplianceState(
  items: EntityComplianceInput[],
  today: Date | string = new Date(),
): EntityComplianceState {
  let hasExpired = false;
  let hasSoon = false;

  for (const it of items) {
    if (!it.expires_at) continue;
    const { status } = complianceStatus(it.expires_at, today);
    if (status === 'expired') hasExpired = true;
    else if (status === 'soon') hasSoon = true;
  }

  const worstStatus: ComplianceStatus = hasExpired ? 'expired' : hasSoon ? 'soon' : 'ok';
  return { hasExpired, hasSoon, worstStatus };
}

/**
 * Critère de blocage : une entité est « non conforme planification »
 * si elle a au moins une échéance expirée. Les échéances `soon`
 * (proches mais non encore expirées) ne bloquent pas — elles
 * apparaissent en avertissement.
 */
export function isPlanningBlocking(state: EntityComplianceState): boolean {
  return state.hasExpired;
}
