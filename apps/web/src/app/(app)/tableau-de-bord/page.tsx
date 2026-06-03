import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { getDashboardData } from './_lib/queries-dashboard';
import { deltaPercent, deltaPoints } from './_lib/delta';
import { KpiCard, type KpiState } from './_components/kpi-card';
import { ComplianceCard } from './_components/compliance-card';
import { SlaBadgesCard } from './_components/sla-badges-card';

export const metadata = { title: 'Tableau de bord' };
export const dynamic = 'force-dynamic';

/**
 * Tableau de bord dirigeant (Phase 06.8) — page d'accueil de pilotage.
 *
 * Server Component rendu au chargement (D-03 — pas de temps réel), réservé au
 * dirigeant (D-02). Layout en pyramide inversée : bloc « À traiter » en haut,
 * bloc « Activité » dessous, carte de conformité en pied.
 */

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  cb: 'CB',
  cheque: 'Chèque',
  cgss_differe: 'CGSS différé',
  inconnu: 'Non précisé',
};

function tauxState(taux: number): { state: KpiState; label: string } {
  if (taux > 15) return { state: 'alerte', label: 'au-dessus du seuil de 10 %' };
  if (taux >= 10) return { state: 'attention', label: 'proche du seuil de 10 %' };
  return { state: 'succes', label: 'sous le seuil de 10 %' };
}

function plural(n: number, sing: string, plur: string): string {
  return `${n} ${n > 1 ? plur : sing}`;
}

/** `YYYY-MM` → libellé fr « mai 2026 ». */
function moisEnClair(mois: string): string {
  return format(new Date(`${mois}-01T00:00:00`), 'MMMM yyyy', { locale: fr });
}

/** Mois précédent au format `YYYY-MM` (wrap année correct). */
function previousMonthOf(ym: string): string {
  const [yearStr, monthStr] = ym.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

export default async function TableauDeBordPage(): Promise<JSX.Element> {
  await requireDirigeantPage();
  const data = await getDashboardData();

  const periode = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

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

  const ventilation = Object.entries(data.caMois.by_method).map(([method, montant]) => ({
    label: METHOD_LABELS[method] ?? method,
    value: eur.format(montant),
  }));

  const taux = tauxState(data.incidents.taux);

  // Wave 1 Phase 06.11 — A4 : comparatif N vs N-1 (pattern Stripe Balance).
  const moisPrecLibelle = moisEnClair(previousMonthOf(data.moisCourant));
  const caDelta = deltaPercent(data.caMois.total_eur, data.caMoisPrec.total_eur);
  const volDelta = deltaPercent(data.volume.mois, data.volMoisPrec);
  const incidentsDelta = deltaPoints(data.incidents.taux, data.incidentsPrec.taux);

  return (
    <div className="space-y-24">
      <header className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <p className="text-muted-foreground text-sm">
          Vue d&apos;ensemble de votre activité · {periode}
        </p>
      </header>

      <section className="space-y-12" aria-labelledby="bloc-action">
        <h2 id="bloc-action" className="text-muted-foreground text-sm font-semibold uppercase">
          À traiter
        </h2>
        <div className="grid gap-16 sm:grid-cols-2">
          <KpiCard
            variant="simple"
            label="Courses à facturer"
            value={String(data.coursesAFacturer)}
            context={
              data.coursesAFacturer === 0
                ? 'Aucune course à facturer ce mois'
                : `${moisEnClair(data.moisCourant)} · tiers payant CGSS`
            }
            action={{ href: `/admin/facturation?mois=${data.moisCourant}`, label: 'Facturer' }}
          />
          <KpiCard variant="alerte" label="Alertes" items={alerteItems} />
        </div>
      </section>

      {/* Wave 1 Phase 06.11 — A3 SLA factuels datés (carte distincte). */}
      <SlaBadgesCard rules={data.slaRules} />

      <section className="space-y-12" aria-labelledby="bloc-sante">
        <h2 id="bloc-sante" className="text-muted-foreground text-sm font-semibold uppercase">
          Activité
        </h2>
        <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            variant="ventilation"
            label="CA du mois"
            value={eur.format(data.caMois.total_eur)}
            lines={ventilation}
          />
          <KpiCard
            variant="multi"
            label="Volume de courses"
            rows={[
              { label: "Aujourd'hui", value: String(data.volume.aujourdhui) },
              { label: '7 derniers jours', value: String(data.volume.semaine) },
              { label: 'Ce mois', value: String(data.volume.mois) },
            ]}
          />
          <KpiCard
            variant="simple"
            label="No-show / annulation"
            value={`${data.incidents.taux} %`}
            state={taux.state}
            stateLabel={taux.label}
            context={`${data.incidents.noShow} no-show · ${data.incidents.annulations} annulation${
              data.incidents.annulations > 1 ? 's' : ''
            } ce mois`}
            delta={incidentsDelta}
            deltaUnit="pts"
            deltaSign="inverse"
            previousLabel={moisPrecLibelle}
            previousValue={`${data.incidentsPrec.taux} %`}
          />
          <KpiCard
            variant="simple"
            label="Chauffeurs"
            value={`${data.chauffeurs.actifsAvecCourse} / ${data.chauffeurs.totalActifs}`}
            context={`avec une course aujourd'hui · ~${data.chauffeurs.moyenneParChauffeur} par chauffeur`}
          />
        </div>

        {/* Wave 1 Phase 06.11 — A4 : CA + Volume avec comparatif N vs N-1. */}
        <div className="grid gap-16 sm:grid-cols-2">
          <KpiCard
            variant="simple"
            label="CA encaissé du mois"
            value={eur.format(data.caMois.total_eur)}
            delta={caDelta}
            deltaUnit="%"
            deltaSign="positive"
            previousLabel={moisPrecLibelle}
            previousValue={eur.format(data.caMoisPrec.total_eur)}
          />
          <KpiCard
            variant="simple"
            label="Volume du mois"
            value={String(data.volume.mois)}
            delta={volDelta}
            deltaUnit="%"
            deltaSign="positive"
            previousLabel={moisPrecLibelle}
            previousValue={String(data.volMoisPrec)}
          />
        </div>
      </section>

      <ComplianceCard conformite={data.conformite} />
    </div>
  );
}
