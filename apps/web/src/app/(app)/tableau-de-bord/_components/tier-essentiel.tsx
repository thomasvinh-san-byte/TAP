import type { DashboardData } from '../_lib/queries-dashboard';
import { deltaPercent } from '../_lib/delta';
import { KpiCard } from './kpi-card';
import { SlaBadgesCard } from './sla-badges-card';
import {
  TIER_TITLE_CLASS,
  eur,
  METHOD_LABELS,
  moisEnClair,
  previousMonthOf,
  encoursState,
  plural,
} from './dashboard-shared';

/**
 * Tier 1 « L'essentiel » — scorecard de tête (pyramide inversée / scan F) : le
 * vital d'abord, le plus critique en HAUT-GAUCHE. 3 KPI hero (CA encaissé →
 * encours → courses à facturer) répondent à « où en est-on ? » d'un coup d'œil ;
 * la couleur ne marque que le statut (seuil). Puis les actionnables à traiter.
 *
 * Iso-fonctionnel : extrait de `page.tsx` sans changement de rendu ni de calcul.
 * Reçoit `data` en props (fetch unique au niveau page).
 */
export function TierEssentiel({ data }: { data: DashboardData }): JSX.Element {
  const moisPrecLibelle = moisEnClair(previousMonthOf(data.moisCourant));
  const caDelta = deltaPercent(data.caMois.total_eur, data.caMoisPrec.total_eur);
  const encours = encoursState(data.encoursImpaye.total_eur);

  // Ventilation par mode de paiement condensée en contexte (densité 06.49 —
  // l'info est préservée, le détail complet reste dans Caisse).
  const ventilation = Object.entries(data.caMois.by_method).map(([method, montant]) => ({
    label: METHOD_LABELS[method] ?? method,
    value: eur.format(montant),
  }));
  const ventilationContext =
    ventilation.length > 0
      ? ventilation.map((l) => `${l.label} ${l.value}`).join(' · ')
      : undefined;

  const alerteItems: { label: string; href?: string }[] = [];
  if (data.facturesIncompletes > 0) {
    alerteItems.push({
      label: plural(data.facturesIncompletes, 'facture incomplète', 'factures incomplètes'),
      href: '/admin/facturation',
    });
  }
  if (data.noShowsRecents > 0) {
    alerteItems.push({
      label: `${plural(data.noShowsRecents, 'no-show', 'no-shows')} (7 derniers jours)`,
      href: '/courses',
    });
  }
  // Wave 1 Phase 06.11 — A5 : 3 règles d'alertes proactives supplémentaires.
  if (data.coursesTermineesSansTarif48h > 0) {
    alerteItems.push({
      label: `${data.coursesTermineesSansTarif48h} course${
        data.coursesTermineesSansTarif48h > 1 ? 's' : ''
      } terminée${data.coursesTermineesSansTarif48h > 1 ? 's' : ''} sans tarif depuis plus de 48 h`,
      href: '/admin/facturation',
    });
  }
  if (data.chauffeursInactifs7j > 0) {
    alerteItems.push({
      label: `${data.chauffeursInactifs7j} chauffeur${
        data.chauffeursInactifs7j > 1 ? 's' : ''
      } sans course depuis 7 jours`,
      // Concerns: D4-a — la query param `?inactif=true` côté UI n'est pas encore filtrée.
      // Le lien vers la liste reste utile, la régulatrice trie manuellement.
      href: '/admin/chauffeurs',
    });
  }
  if (data.smsFailed24h > 0) {
    alerteItems.push({
      label: `${data.smsFailed24h} SMS non délivré${
        data.smsFailed24h > 1 ? 's' : ''
      } ces dernières 24 h`,
      href: '/admin/sms-templates',
    });
  }

  return (
    <section className="space-y-8" aria-labelledby="tier-essentiel">
      <h2 id="tier-essentiel" className={TIER_TITLE_CLASS}>
        L&apos;essentiel
      </h2>
      <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
        {/* Le plus vital, en premier dans le scan : entrées d'argent. */}
        <KpiCard
          variant="simple"
          size="hero"
          className="lg:min-h-[132px]"
          label="CA encaissé du mois"
          value={eur.format(data.caMois.total_eur)}
          context={ventilationContext}
          delta={caDelta}
          deltaUnit="%"
          deltaSign="positive"
          previousLabel={moisPrecLibelle}
          previousValue={eur.format(data.caMoisPrec.total_eur)}
        />
        {/* Trésorerie à risque — la couleur d'état (seuil) porte l'exception. */}
        <KpiCard
          variant="simple"
          size="hero"
          className="lg:min-h-[132px]"
          label="Encours impayé"
          value={eur.format(data.encoursImpaye.total_eur)}
          state={encours.state}
          stateLabel={encours.label}
          context={`${data.encoursImpaye.count} course${
            data.encoursImpaye.count > 1 ? 's' : ''
          } à encaisser`}
          action={{ href: '/courses/caisse?vue=a_encaisser', label: 'Encaisser' }}
        />
        {/* Pipeline à facturer — argent à venir + action directe. */}
        <KpiCard
          variant="simple"
          size="hero"
          className="lg:min-h-[132px]"
          label="Courses à facturer"
          value={String(data.coursesAFacturer)}
          context={
            data.coursesAFacturer === 0
              ? 'Aucune course à facturer ce mois'
              : `${moisEnClair(data.moisCourant)} · tiers payant CGSS`
          }
          action={{ href: `/admin/facturation?mois=${data.moisCourant}`, label: 'Facturer' }}
        />
      </div>
      {/* Actionnables à traiter (listes, pas des KPI) — sous le scorecard. */}
      <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-2">
        <KpiCard variant="alerte" label="Alertes" items={alerteItems} />
        <SlaBadgesCard rules={data.slaRules} />
      </div>
    </section>
  );
}
