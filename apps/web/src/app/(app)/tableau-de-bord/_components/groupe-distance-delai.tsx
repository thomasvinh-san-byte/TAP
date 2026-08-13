import type { DistanceDelaiKpis } from '../_lib/distance-delai-kpis';
import { KpiCard } from './kpi-card';
import { GROUP_LABEL_CLASS, km1, delaiLabel } from './dashboard-shared';

/**
 * Sous-groupe Tier 3 « Distance & délai (estimés) » (Lot 5.20-B) — libellé
 * « estimé » explicite, courses sans coordonnées exclues (garde-fou). « Non
 * disponible » si aucune course estimable. Iso-fonctionnel : extrait de
 * `page.tsx` sans changement.
 */
export function GroupeDistanceDelai({
  distanceDelai,
}: {
  distanceDelai: DistanceDelaiKpis;
}): JSX.Element {
  return (
    <div className="space-y-4">
      <p className={GROUP_LABEL_CLASS}>Distance &amp; délai (estimés)</p>
      <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          variant="simple"
          size="compact"
          label="Km moyen / course"
          value={
            distanceDelai.ridesAvecDistance > 0
              ? `${km1.format(distanceDelai.kmMoyenParCourse)} km`
              : '—'
          }
          context={
            distanceDelai.ridesAvecDistance > 0
              ? `estimé (facteur routier 1,3) · sur ${distanceDelai.ridesAvecDistance}/${distanceDelai.ridesRealisees} course${
                  distanceDelai.ridesRealisees > 1 ? 's' : ''
                } géolocalisée${distanceDelai.ridesAvecDistance > 1 ? 's' : ''}`
              : 'Aucune course géolocalisée ce mois'
          }
        />
        <KpiCard
          variant="simple"
          size="compact"
          label="Km à vide / en charge"
          value={distanceDelai.kmEnChargeTotal > 0 ? `${distanceDelai.ratioAVidePct} %` : '—'}
          context={
            distanceDelai.kmEnChargeTotal > 0
              ? `${km1.format(distanceDelai.kmAVideTotal)} km à vide · ${km1.format(
                  distanceDelai.kmEnChargeTotal,
                )} km en charge (estimés)`
              : 'Non disponible'
          }
        />
        <KpiCard
          variant="simple"
          size="compact"
          label="Délai moyen de prise en charge"
          value={distanceDelai.ridesAvecDelai > 0 ? delaiLabel(distanceDelai.delaiMoyenMin) : '—'}
          context={
            distanceDelai.ridesAvecDelai > 0
              ? `sur ${distanceDelai.ridesAvecDelai} course${
                  distanceDelai.ridesAvecDelai > 1 ? 's' : ''
                } démarrée${distanceDelai.ridesAvecDelai > 1 ? 's' : ''} · écart programmé/réel`
              : 'Aucune course démarrée ce mois'
          }
        />
      </div>
    </div>
  );
}
