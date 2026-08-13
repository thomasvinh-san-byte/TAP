import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';
import { getDashboardData } from './_lib/queries-dashboard';
import { getComplianceAlerts } from '../../(admin)/admin/conformite/_lib/get-compliance-alerts';
import { ExportStatsButton } from './_components/export-stats-button.client';
import { TierEssentiel } from './_components/tier-essentiel';
import { TierActivite } from './_components/tier-activite';
import { TierDetail } from './_components/tier-detail';

export const metadata = { title: 'Tableau de bord' };
export const dynamic = 'force-dynamic';

/**
 * Tableau de bord dirigeant (Phase 06.8) — page d'accueil de pilotage.
 *
 * Server Component : ASSEMBLEUR mince (refactor structurel). Point de fetch
 * UNIQUE (`getDashboardData` + `getComplianceAlerts`), puis composition des
 * 3 tiers (pyramide inversée / scan F) :
 *   - Tier 1 « L'essentiel » (scorecard hero) ;
 *   - Tier 2 « Activité & pilotage » (drivers + prévisionnel/réalisation) ;
 *   - Tier 3 « Détail & diagnostic » (opérationnel, distance/délai, économie,
 *     tops, conformité) — repliable.
 * Chaque tier / sous-groupe vit dans son propre composant sous `_components/` :
 *   une évolution de KPI touche un petit fichier isolé, pas ce page → surface
 *   de conflit de merge minime. Réservé au dirigeant (D-02).
 */
export default async function TableauDeBordPage(): Promise<JSX.Element> {
  await requireDirigeantPage();
  // DEC-150 perf : les deux sources sont indépendantes → parallélisées
  // (waterfall séquentiel supprimé). L'auth (requireDirigeantPage) reste avant.
  const [data, complianceAlerts] = await Promise.all([getDashboardData(), getComplianceAlerts()]);

  const periode = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-16">
      <PageHeader
        title="Tableau de bord"
        description={<>Vue d&apos;ensemble de votre activité · {periode}</>}
        actions={<ExportStatsButton />}
      />
      <TierEssentiel data={data} />
      <TierActivite data={data} />
      <TierDetail data={data} complianceAlerts={complianceAlerts} />
    </div>
  );
}
