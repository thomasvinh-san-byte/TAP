import Link from 'next/link';
import type { EconomicKpis } from '../_lib/economic-kpis';
import { KpiCard } from './kpi-card';
import { GROUP_LABEL_CLASS, eur, km2 } from './dashboard-shared';

/**
 * Sous-groupe Tier 3 « Économie (estimée) » (Lot 5.20-E) — « Non configuré »
 * tant que les paramètres de coût ne sont pas saisis (garde-fou : pas de zéro
 * trompeur). Marge = CA − coût estimé. Iso-fonctionnel : extrait de `page.tsx`.
 */
export function GroupeEconomie({ economique }: { economique: EconomicKpis }): JSX.Element {
  return (
    <div className="space-y-4">
      <p className={GROUP_LABEL_CLASS}>Économie (estimée)</p>
      {!economique.configured ? (
        <div className="grid grid-cols-1 items-stretch gap-8">
          <KpiCard
            variant="simple"
            size="compact"
            label="Marge brute"
            value="Non configuré"
            context="Renseignez les coûts (carburant, entretien, amortissement) pour estimer la marge."
            action={{ href: '/admin/parametres-couts', label: 'Configurer les coûts' }}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            variant="simple"
            size="compact"
            label="Coût / km"
            value={`${km2.format(economique.coutParKm)} €/km`}
            context="Carburant + entretien + amortissement (paramétré)"
          />
          <KpiCard
            variant="simple"
            size="compact"
            label="Marge brute"
            value={eur.format(economique.margeBrute)}
            context={`CA ${eur.format(economique.caRealiseTotal)} − coût ${eur.format(
              economique.coutEstimeTotal,
            )} · ${economique.ridesEstimables} course${
              economique.ridesEstimables > 1 ? 's' : ''
            } estimée${economique.ridesEstimables > 1 ? 's' : ''}`}
          />
          <KpiCard
            variant="simple"
            size="compact"
            label="Rentabilité mutualisées"
            value={eur.format(economique.margeMutualisees)}
            context="Marge estimée sur courses mutualisées"
          />
          <KpiCard
            variant="simple"
            size="compact"
            label="Rentabilité non mutualisées"
            value={eur.format(economique.margeNonMutualisees)}
            context="Marge estimée hors mutualisation"
          />
        </div>
      )}
      {economique.configured ? (
        <p className="text-muted-foreground text-xs">
          Marge estimée (coût/km paramétré × distance estimée). Courses sans coordonnées exclues.{' '}
          <Link href="/admin/parametres-couts" className="underline">
            Modifier les coûts
          </Link>
        </p>
      ) : null}
    </div>
  );
}
