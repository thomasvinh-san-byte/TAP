import Link from 'next/link';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { requireDirigeantPage } from '@/lib/auth/require-dirigeant-page';
import { PageHeader } from '@/components/page-header';
import { getDashboardData } from './_lib/queries-dashboard';
import { deltaPercent, deltaPoints } from './_lib/delta';
import { KpiCard, type KpiState } from './_components/kpi-card';
import { ComplianceCard } from './_components/compliance-card';
import { PrescriptionsCard } from './_components/prescriptions-card';
import { CommercialTopsCard } from './_components/commercial-tops-card';
import { SlaBadgesCard } from './_components/sla-badges-card';
import { ExportStatsButton } from './_components/export-stats-button.client';
import { getComplianceAlerts } from '../../(admin)/admin/conformite/_lib/get-compliance-alerts';
import { ComplianceAlertsPanel } from '../../(admin)/admin/conformite/_components/compliance-alerts-panel.client';

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
// Lot 5.20-E — coût/km à 2-3 décimales (le €/km est fin).
const km2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });

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

// KPI-02 — seuils d'encours impayé (€). Pas de référence métier universelle pour
// le transport sanitaire 974 → valeurs nommées À VALIDER avec le dirigeant
// (plutôt qu'un chiffre magique enfoui). Le calibrage se fera à l'usage.
const ENCOURS_ATTENTION_EUR = 500;
const ENCOURS_ALERTE_EUR = 1500;

function encoursState(total: number): { state: KpiState; label: string } {
  if (total >= ENCOURS_ALERTE_EUR) {
    return { state: 'alerte', label: `au-dessus de ${ENCOURS_ALERTE_EUR} €` };
  }
  if (total >= ENCOURS_ATTENTION_EUR) {
    return { state: 'attention', label: `au-dessus de ${ENCOURS_ATTENTION_EUR} €` };
  }
  return { state: 'succes', label: 'sous le seuil de vigilance' };
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
  // DEC-150 perf : les deux sources sont indépendantes → parallélisées
  // (waterfall séquentiel supprimé). L'auth (requireDirigeantPage) reste avant.
  const [data, complianceAlerts] = await Promise.all([getDashboardData(), getComplianceAlerts()]);

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
  // Ventilation par mode de paiement condensée en contexte (densité 06.49 —
  // l'info est préservée, le détail complet reste dans Caisse).
  const ventilationContext =
    ventilation.length > 0
      ? ventilation.map((l) => `${l.label} ${l.value}`).join(' · ')
      : undefined;

  const taux = tauxState(data.incidents.taux);
  const encours = encoursState(data.encoursImpaye.total_eur);

  // DEC-166 — Panier moyen / course (CdG §5.20 l.501) : DÉRIVÉ, pas de requête.
  // Périmètre COHÉRENT : CA encaissé ÷ courses encaissées (caMois.count = nombre
  // de courses terminées+encaissées, même ensemble que caMois.total_eur).
  // Division par zéro gérée (0 course → 0 €).
  const panierMoyen = data.caMois.count > 0 ? data.caMois.total_eur / data.caMois.count : 0;

  // Wave 1 Phase 06.11 — A4 : comparatif N vs N-1 (pattern Stripe Balance).
  const moisPrecLibelle = moisEnClair(previousMonthOf(data.moisCourant));
  const caDelta = deltaPercent(data.caMois.total_eur, data.caMoisPrec.total_eur);
  const volDelta = deltaPercent(data.volume.mois, data.volMoisPrec);
  const incidentsDelta = deltaPoints(data.incidents.taux, data.incidentsPrec.taux);

  return (
    <div className="space-y-12">
      <PageHeader
        title="Tableau de bord"
        description={<>Vue d&apos;ensemble de votre activité · {periode}</>}
        actions={<ExportStatsButton />}
      />

      {/* Rangée 1 — À traiter (3 colonnes : facturation · alertes · délais légaux). */}
      <section className="space-y-4" aria-labelledby="bloc-action">
        <h2
          id="bloc-action"
          className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
        >
          À traiter
        </h2>
        <div className="grid items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
          {/* SLA factuels datés (Wave 1 Phase 06.11 — A3), intégré en 3e colonne. */}
          <SlaBadgesCard rules={data.slaRules} />
        </div>
      </section>

      {/* Rangée 2 — Activité du mois en bento ASYMÉTRIQUE (norme dashboard
          exécutif) : la taille porte la priorité avant qu'on lise un libellé.
          Grille 12 colonnes (langage cockpit / fiche patient), écart uniforme,
          hauteurs définies, ordre DOM = ordre visuel = ordre de priorité.
          Calculs et props des KPIs strictement inchangés — présentation seule. */}
      <section className="space-y-4" aria-labelledby="bloc-sante">
        <h2
          id="bloc-sante"
          className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
        >
          Activité du mois
        </h2>
        <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-12">
          {/* HÉROS — santé financière (entrées vs argent bloqué), avec tendance/seuil. */}
          <KpiCard
            variant="simple"
            size="hero"
            className="lg:col-span-6 lg:min-h-[120px]"
            label="CA encaissé du mois"
            value={eur.format(data.caMois.total_eur)}
            context={ventilationContext}
            delta={caDelta}
            deltaUnit="%"
            deltaSign="positive"
            previousLabel={moisPrecLibelle}
            previousValue={eur.format(data.caMoisPrec.total_eur)}
          />
          {/* KPI-02 — trésorerie à risque : stock cumulé (12 mois) des courses
              dues non encaissées. La couleur d'état (seuil) porte l'exception. */}
          <KpiCard
            variant="simple"
            size="hero"
            className="lg:col-span-6 lg:min-h-[120px]"
            label="Encours impayé"
            value={eur.format(data.encoursImpaye.total_eur)}
            state={encours.state}
            stateLabel={encours.label}
            context={`${data.encoursImpaye.count} course${
              data.encoursImpaye.count > 1 ? 's' : ''
            } à encaisser`}
            action={{ href: '/courses/caisse?vue=a_encaisser', label: 'Encaisser' }}
          />

          {/* PRIMAIRES — volume / no-show / panier (moyens). */}
          <KpiCard
            variant="simple"
            className="lg:col-span-4"
            label="Volume du mois"
            value={String(data.volume.mois)}
            delta={volDelta}
            deltaUnit="%"
            deltaSign="positive"
            previousLabel={moisPrecLibelle}
            previousValue={String(data.volMoisPrec)}
          />
          <KpiCard
            variant="simple"
            className="lg:col-span-4"
            label="No-show"
            value={`${data.incidents.taux} %`}
            state={taux.state}
            stateLabel={taux.label}
            context={`${data.incidents.noShow} no-show · ${data.incidents.annulations} annulation${
              data.incidents.annulations > 1 ? 's' : ''
            }`}
            delta={incidentsDelta}
            deltaUnit="pts"
            deltaSign="inverse"
            previousLabel={moisPrecLibelle}
            previousValue={`${data.incidentsPrec.taux} %`}
          />
          <KpiCard
            variant="simple"
            className="lg:col-span-4"
            label="Panier moyen / course"
            value={eur.format(panierMoyen)}
            context={`sur ${data.caMois.count} course${data.caMois.count > 1 ? 's' : ''} encaissée${
              data.caMois.count > 1 ? 's' : ''
            }`}
          />

          {/* SECONDAIRES — chauffeurs / aujourd'hui (petits, contexte). */}
          <KpiCard
            variant="simple"
            size="compact"
            className="lg:col-span-6"
            label="Chauffeurs"
            value={`${data.chauffeurs.actifsAvecCourse} / ${data.chauffeurs.totalActifs}`}
            context={`actifs aujourd'hui · ~${data.chauffeurs.moyenneParChauffeur}/chauffeur`}
          />
          <KpiCard
            variant="simple"
            size="compact"
            className="lg:col-span-6"
            label="Aujourd'hui"
            value={String(data.volume.aujourdhui)}
            context={`7 derniers jours : ${data.volume.semaine}`}
          />
        </div>
      </section>

      {/* Rangée 2bis — Indicateurs opérationnels (Lot 5.20-A) : dérivés DIRECT
          des courses du mois. « Non disponible » si aucune course (pas de 0 %
          trompeur — même doctrine que le refus d'une métrique sans données). */}
      <section className="space-y-4" aria-labelledby="bloc-operationnel">
        <h2
          id="bloc-operationnel"
          className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
        >
          Indicateurs opérationnels du mois
        </h2>
        <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            variant="simple"
            label="Taux de mutualisation"
            value={data.operationnel.total > 0 ? `${data.operationnel.tauxMutualisation} %` : '—'}
            context={
              data.operationnel.total > 0
                ? `${data.operationnel.mutualisees} course${
                    data.operationnel.mutualisees > 1 ? 's' : ''
                  } mutualisée${data.operationnel.mutualisees > 1 ? 's' : ''} sur ${data.operationnel.total}`
                : 'Aucune course ce mois'
            }
          />
          <KpiCard
            variant="ventilation"
            label="Annulations par motif"
            value={data.operationnel.total > 0 ? `${data.operationnel.tauxAnnulation} %` : '—'}
            lines={
              data.operationnel.annulationParMotif.length > 0
                ? data.operationnel.annulationParMotif.map((m) => ({
                    label: m.label,
                    value: String(m.count),
                  }))
                : [
                    {
                      label: data.operationnel.total > 0 ? 'Aucune annulation' : 'Non disponible',
                      value: '—',
                    },
                  ]
            }
          />
          <KpiCard
            variant="simple"
            label="Taux de patient absent"
            value={data.operationnel.total > 0 ? `${data.operationnel.tauxPatientAbsent} %` : '—'}
            context={
              data.operationnel.total > 0
                ? `${data.operationnel.patientAbsent} absence${
                    data.operationnel.patientAbsent > 1 ? 's' : ''
                  } sur ${data.operationnel.total}`
                : 'Aucune course ce mois'
            }
          />
          <KpiCard
            variant="multi"
            label="Récurrentes vs ponctuelles"
            rows={[
              {
                label: 'Récurrentes',
                value:
                  data.operationnel.total > 0
                    ? `${data.operationnel.recurrentes} · ${data.operationnel.tauxRecurrentes} %`
                    : '—',
              },
              {
                label: 'Ponctuelles',
                value: data.operationnel.total > 0 ? String(data.operationnel.ponctuelles) : '—',
              },
            ]}
          />
        </div>
      </section>

      {/* Rangée 2ter — Économie du mois ESTIMÉE (Lot 5.20-E). Marge = CA − coût
          (coût/km paramétré × distance estimée Haversine). « Non configuré » tant
          que les paramètres de coût ne sont pas saisis (pas de zéro trompeur). */}
      <section className="space-y-4" aria-labelledby="bloc-economie">
        <h2
          id="bloc-economie"
          className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
        >
          Économie du mois (estimée)
        </h2>
        {!data.economique.configured ? (
          <div className="grid grid-cols-1 items-stretch gap-8">
            <KpiCard
              variant="simple"
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
              label="Coût / km"
              value={`${km2.format(data.economique.coutParKm)} €/km`}
              context="Carburant + entretien + amortissement (paramétré)"
            />
            <KpiCard
              variant="simple"
              label="Marge brute"
              value={eur.format(data.economique.margeBrute)}
              context={`CA ${eur.format(data.economique.caRealiseTotal)} − coût ${eur.format(
                data.economique.coutEstimeTotal,
              )} · ${data.economique.ridesEstimables} course${
                data.economique.ridesEstimables > 1 ? 's' : ''
              } estimée${data.economique.ridesEstimables > 1 ? 's' : ''}`}
            />
            <KpiCard
              variant="simple"
              label="Rentabilité mutualisées"
              value={eur.format(data.economique.margeMutualisees)}
              context="Marge estimée sur courses mutualisées"
            />
            <KpiCard
              variant="simple"
              label="Rentabilité non mutualisées"
              value={eur.format(data.economique.margeNonMutualisees)}
              context="Marge estimée hors mutualisation"
            />
          </div>
        )}
        {data.economique.configured ? (
          <p className="text-muted-foreground text-xs">
            Marge estimée (coût/km paramétré × distance estimée). Courses sans coordonnées exclues.{' '}
            <Link href="/admin/parametres-couts" className="underline">
              Modifier les coûts
            </Link>
          </p>
        ) : null}
      </section>

      {/* Rangée 3 — Prescriptions + tops commerciaux (CdG §5.20, DEC-164/165). */}
      <section className="space-y-4" aria-labelledby="bloc-prescriptions">
        <h2
          id="bloc-prescriptions"
          className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
        >
          Prescriptions &amp; tops commerciaux
        </h2>
        <div className="grid items-stretch gap-8 lg:grid-cols-2">
          <PrescriptionsCard prescriptions={data.prescriptions} />
          <CommercialTopsCard commercial={data.commercial} />
        </div>
      </section>

      {/* Rangée 4 — Conformité & échéances (2 colonnes condensées). */}
      <section className="space-y-4" aria-labelledby="bloc-conformite">
        <h2
          id="bloc-conformite"
          className="text-muted-foreground text-xs font-semibold uppercase tracking-wide"
        >
          Conformité &amp; échéances
        </h2>
        <div className="grid items-stretch gap-8 lg:grid-cols-2">
          <ComplianceCard conformite={data.conformite} />
          <ComplianceAlertsPanel alerts={complianceAlerts} variant="card" limit={5} />
        </div>
      </section>
    </div>
  );
}
