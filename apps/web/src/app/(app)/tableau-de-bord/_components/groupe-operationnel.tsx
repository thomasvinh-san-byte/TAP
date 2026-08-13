import type { OperationalKpis } from '../_lib/operational-kpis';
import { KpiCard } from './kpi-card';
import { GROUP_LABEL_CLASS } from './dashboard-shared';

/**
 * Sous-groupe Tier 3 « Opérationnel » (Lot 5.20-A) — dérivé direct des courses
 * du mois. « Non disponible »/« Aucune course » si aucune donnée (garde-fou
 * d'honnêteté). Iso-fonctionnel : extrait de `page.tsx` sans changement.
 */
export function GroupeOperationnel({
  operationnel,
}: {
  operationnel: OperationalKpis;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <p className={GROUP_LABEL_CLASS}>Opérationnel</p>
      <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          variant="simple"
          size="compact"
          label="Taux de mutualisation"
          value={operationnel.total > 0 ? `${operationnel.tauxMutualisation} %` : '—'}
          context={
            operationnel.total > 0
              ? `${operationnel.mutualisees} course${
                  operationnel.mutualisees > 1 ? 's' : ''
                } mutualisée${operationnel.mutualisees > 1 ? 's' : ''} sur ${operationnel.total}`
              : 'Aucune course ce mois'
          }
        />
        <KpiCard
          variant="ventilation"
          size="compact"
          label="Annulations par motif"
          value={operationnel.total > 0 ? `${operationnel.tauxAnnulation} %` : '—'}
          lines={
            operationnel.annulationParMotif.length > 0
              ? operationnel.annulationParMotif.map((m) => ({
                  label: m.label,
                  value: String(m.count),
                }))
              : [
                  {
                    label: operationnel.total > 0 ? 'Aucune annulation' : 'Non disponible',
                    value: '—',
                  },
                ]
          }
        />
        <KpiCard
          variant="simple"
          size="compact"
          label="Taux de patient absent"
          value={operationnel.total > 0 ? `${operationnel.tauxPatientAbsent} %` : '—'}
          context={
            operationnel.total > 0
              ? `${operationnel.patientAbsent} absence${
                  operationnel.patientAbsent > 1 ? 's' : ''
                } sur ${operationnel.total}`
              : 'Aucune course ce mois'
          }
        />
        <KpiCard
          variant="multi"
          size="compact"
          label="Récurrentes vs ponctuelles"
          rows={[
            {
              label: 'Récurrentes',
              value:
                operationnel.total > 0
                  ? `${operationnel.recurrentes} · ${operationnel.tauxRecurrentes} %`
                  : '—',
            },
            {
              label: 'Ponctuelles',
              value: operationnel.total > 0 ? String(operationnel.ponctuelles) : '—',
            },
          ]}
        />
      </div>
    </div>
  );
}
