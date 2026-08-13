import { ChevronDown } from 'lucide-react';
import type { DashboardData } from '../_lib/queries-dashboard';
import type { ComplianceAlertEnriched } from '../../../(admin)/admin/conformite/_lib/get-compliance-alerts';
import { TIER_TITLE_CLASS } from './dashboard-shared';
import { GroupeOperationnel } from './groupe-operationnel';
import { GroupeDistanceDelai } from './groupe-distance-delai';
import { GroupeEconomie } from './groupe-economie';
import { GroupePrescriptionsTops } from './groupe-prescriptions-tops';
import { GroupeConformite } from './groupe-conformite';

/**
 * Tier 3 « Détail & diagnostic » — pour qui veut creuser : opérationnel,
 * distance/délai, économie, tops, conformité, en `compact`, regroupés par
 * sous-thème (un composant par sous-groupe). REPLIABLE (native `<details>`,
 * ouvert par défaut) pour alléger la surface visible sans masquer de donnée.
 *
 * Iso-fonctionnel : conteneur extrait de `page.tsx`, chaque sous-groupe déplacé
 * dans son propre fichier. Reçoit `data` + les alertes conformité en props.
 */
export function TierDetail({
  data,
  complianceAlerts,
}: {
  data: DashboardData;
  complianceAlerts: ComplianceAlertEnriched[];
}): JSX.Element {
  return (
    <details open className="group space-y-8 [&_summary::-webkit-details-marker]:hidden">
      <summary className="focus-visible:ring-ring flex cursor-pointer list-none items-center gap-8 rounded-md focus-visible:outline-none focus-visible:ring-2">
        <h2 id="tier-detail" className={TIER_TITLE_CLASS}>
          Détail &amp; diagnostic
        </h2>
        <ChevronDown
          className="text-muted-foreground h-16 w-16 transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>

      <GroupeOperationnel operationnel={data.operationnel} />
      <GroupeDistanceDelai distanceDelai={data.distanceDelai} />
      <GroupeEconomie economique={data.economique} />
      <GroupePrescriptionsTops prescriptions={data.prescriptions} commercial={data.commercial} />
      <GroupeConformite conformite={data.conformite} alerts={complianceAlerts} />
    </details>
  );
}
