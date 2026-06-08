/**
 * Helper pur — statut dérivé d'une échéance réglementaire (Phase 06.33,
 * DEC-112).
 *
 * Le statut n'est PAS stocké en BDD (DEC-112 D-04) — il dérive
 * d'`expires_at` vs aujourd'hui à chaque affichage, sinon il périme.
 *
 * Statuts :
 *   - `ok`       : expires_at = null OU > 90 jours
 *   - `soon`     : 0 ≤ jours jusqu'à expiration ≤ 90 (dans la fenêtre
 *                  d'alerte ; détail des paliers 90/60/30/7 = lot 2 cron).
 *   - `expired`  : expires_at < aujourd'hui
 *
 * Fenêtre 90 jours alignée sur les futurs paliers d'alerte (90/60/30/7 j,
 * CdC §5.21 §2.1 + DEC-112).
 *
 * Module pur (pas de React, pas de Date.now() implicite) — testable et
 * réutilisable côté server (cron lot 2) comme client (badge).
 */

export type ComplianceStatus = 'ok' | 'soon' | 'expired';

export const COMPLIANCE_SOON_DAYS = 90;
export const COMPLIANCE_ALERT_STEPS = [90, 60, 30, 7] as const;

/** Date pure (jour, sans heure) — comparaison strictement calendaire. */
function startOfDay(d: Date | string): Date {
  const x = typeof d === 'string' ? new Date(`${d}T00:00:00`) : new Date(d);
  return new Date(x.getFullYear(), x.getMonth(), x.getDate(), 0, 0, 0, 0);
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calcule le statut d'une échéance.
 *
 * @param expiresAt — date d'échéance (AAAA-MM-JJ ou Date) ou null/undefined.
 * @param today    — date de référence (utile pour les tests).
 * @returns `{ status, daysUntilExpiry }` — `daysUntilExpiry` = null si
 *          expiresAt est null.
 */
export function complianceStatus(
  expiresAt: string | Date | null | undefined,
  today: Date | string = new Date(),
): { status: ComplianceStatus; daysUntilExpiry: number | null } {
  if (!expiresAt) return { status: 'ok', daysUntilExpiry: null };

  const ex = startOfDay(expiresAt);
  const ref = startOfDay(today);

  const days = Math.round((ex.getTime() - ref.getTime()) / ONE_DAY_MS);

  if (days < 0) return { status: 'expired', daysUntilExpiry: days };
  if (days <= COMPLIANCE_SOON_DAYS) return { status: 'soon', daysUntilExpiry: days };
  return { status: 'ok', daysUntilExpiry: days };
}

/**
 * Détermine le palier d'alerte (90/60/30/7) atteint AUJOURD'HUI uniquement
 * — utilisé par le cron du lot 2 pour ne notifier qu'aux franchissements,
 * pas chaque jour de la fenêtre. Renvoie null si pas de franchissement.
 */
export function complianceAlertStep(
  expiresAt: string | Date | null | undefined,
  today: Date | string = new Date(),
): number | null {
  const { daysUntilExpiry } = complianceStatus(expiresAt, today);
  if (daysUntilExpiry === null) return null;
  // Palier atteint : le jour où days passe DE > step À <= step.
  // Pour rester un helper pur sans état, on renvoie le palier exact si
  // days == step (le cron tournant 1×/j capture le franchissement).
  return (COMPLIANCE_ALERT_STEPS as readonly number[]).includes(daysUntilExpiry)
    ? daysUntilExpiry
    : null;
}
