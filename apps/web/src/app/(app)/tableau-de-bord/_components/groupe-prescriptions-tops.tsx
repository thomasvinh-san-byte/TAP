import type { DashboardPrescriptions, DashboardCommercial } from '../_lib/queries-dashboard';
import { PrescriptionsCard } from './prescriptions-card';
import { CommercialTopsCard } from './commercial-tops-card';
import { GROUP_LABEL_CLASS } from './dashboard-shared';

/**
 * Sous-groupe Tier 3 « Prescriptions & tops commerciaux » (DEC-164/165) —
 * classements d'entités B2B (jamais de patients par CA, KPI-01). Réutilise les
 * cartes existantes. Iso-fonctionnel : extrait de `page.tsx` sans changement.
 */
export function GroupePrescriptionsTops({
  prescriptions,
  commercial,
}: {
  prescriptions: DashboardPrescriptions;
  commercial: DashboardCommercial;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <p className={GROUP_LABEL_CLASS}>Prescriptions &amp; tops commerciaux</p>
      <div className="grid items-stretch gap-8 lg:grid-cols-2">
        <PrescriptionsCard prescriptions={prescriptions} />
        <CommercialTopsCard commercial={commercial} />
      </div>
    </div>
  );
}
