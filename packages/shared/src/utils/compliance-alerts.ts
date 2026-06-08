/**
 * Helpers purs — alertes d'échéance dérivées (Phase 06.34, DEC-113).
 *
 * Lot 2 conformité réglementaire : dérive la liste des échéances « à
 * surveiller » d'une collection d'`compliance_items`, sans rien
 * stocker. Le statut/alerte est recalculé à la volée vs la date du
 * jour (Q2 dérivé, RETEX secteur — pas de table d'alertes, pas
 * d'accusé de lecture).
 *
 * Module pur sans dépendance React/Supabase — testable Vitest, partagé
 * cockpit (régulateur) + dashboard (dirigeant) + futur canal externe
 * (email/push) sans refonte.
 */

import { complianceStatus, type ComplianceStatus } from './compliance-status';
import type { ComplianceKind, ComplianceEntityType } from '../validators/compliance';

/** Item brut consommé par le sélecteur (forme minimale BDD). */
export interface ComplianceAlertSource {
  id: string;
  entity_type: ComplianceEntityType;
  entity_id: string | null;
  kind: ComplianceKind;
  expires_at: string | null;
}

/** Item enrichi pour affichage. */
export interface ComplianceAlert {
  id: string;
  entity_type: ComplianceEntityType;
  entity_id: string | null;
  kind: ComplianceKind;
  expires_at: string;
  status: Extract<ComplianceStatus, 'soon' | 'expired'>;
  daysUntilExpiry: number;
}

/**
 * Filtre + trie les items pour ne garder que ceux à surveiller :
 *   - status === 'expired' (déjà passé)
 *   - status === 'soon'    (≤ 90 jours)
 *
 * Tri par urgence : expired d'abord (le plus expiré en haut), puis
 * soon ascendant (le plus proche en haut). Les items 'ok' et ceux
 * sans `expires_at` sont éliminés (rien à alerter).
 */
export function selectComplianceAlerts(
  items: ComplianceAlertSource[],
  today: Date | string = new Date(),
): ComplianceAlert[] {
  const enriched: ComplianceAlert[] = [];

  for (const it of items) {
    if (!it.expires_at) continue;
    const { status, daysUntilExpiry } = complianceStatus(it.expires_at, today);
    if (status !== 'soon' && status !== 'expired') continue;
    if (daysUntilExpiry === null) continue;
    enriched.push({
      id: it.id,
      entity_type: it.entity_type,
      entity_id: it.entity_id,
      kind: it.kind,
      expires_at: it.expires_at,
      status,
      daysUntilExpiry,
    });
  }

  // Tri par urgence :
  //   - expired (days < 0) avant soon (days >= 0)
  //   - dans expired : le plus passé d'abord (days plus négatif)
  //   - dans soon   : le plus proche d'abord (days plus petit)
  enriched.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
  return enriched;
}

/** Buckets de comptage prêts à afficher (dashboard résumé). */
export interface ComplianceAlertCounts {
  expired: number;
  soon: number;
  total: number;
}

export function countComplianceAlerts(alerts: ComplianceAlert[]): ComplianceAlertCounts {
  let expired = 0;
  for (const a of alerts) {
    if (a.status === 'expired') expired += 1;
  }
  return { expired, soon: alerts.length - expired, total: alerts.length };
}
