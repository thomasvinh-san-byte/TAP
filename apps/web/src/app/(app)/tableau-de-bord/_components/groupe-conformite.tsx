import type { DashboardConformite } from '../_lib/queries-dashboard';
import type { ComplianceAlertEnriched } from '../../../(admin)/admin/conformite/_lib/get-compliance-alerts';
import { ComplianceCard } from './compliance-card';
import { ComplianceAlertsPanel } from '../../../(admin)/admin/conformite/_components/compliance-alerts-panel.client';
import { GROUP_LABEL_CLASS } from './dashboard-shared';

/**
 * Sous-groupe Tier 3 « Conformité & échéances ». Réutilise la carte de synthèse
 * conformité + le panneau d'alertes (source partagée avec le cockpit).
 * Iso-fonctionnel : extrait de `page.tsx` sans changement.
 */
export function GroupeConformite({
  conformite,
  alerts,
}: {
  conformite: DashboardConformite;
  alerts: ComplianceAlertEnriched[];
}): JSX.Element {
  return (
    <div className="space-y-4">
      <p className={GROUP_LABEL_CLASS}>Conformité &amp; échéances</p>
      <div className="grid items-stretch gap-8 lg:grid-cols-2">
        <ComplianceCard conformite={conformite} />
        <ComplianceAlertsPanel alerts={alerts} variant="card" limit={5} />
      </div>
    </div>
  );
}
