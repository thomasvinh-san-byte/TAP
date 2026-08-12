import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
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
 * dirigeant (D-02). Hiérarchie en PYRAMIDE INVERSÉE (scan F), 3 tiers au lieu de
 * 9 sections plates :
 *   - Tier 1 « L'essentiel » : scorecard de 3 KPI `hero` (le plus critique en
 *     haut-gauche) + les actionnables à traiter ; la couleur = statut seulement.
 *   - Tier 2 « Activité & pilotage » : les drivers qui expliquent le Tier 1
 *     (volume, no-show, panier, activité du jour, effectifs) + prévisionnel /
 *     réalisation, en taille `normal`.
 *   - Tier 3 « Détail & diagnostic » : opérationnel, distance/délai, économie,
 *     prescriptions/tops, conformité, en `compact`, regroupés par sous-thème.
 * Les calculs (`queries-dashboard`, `*-kpis`) sont INCHANGÉS — agencement seul.
 * Les garde-fous d'honnêteté (« estimé », « non configuré », pas de top patients
 * par CA, occupation véhicule absente) restent intacts.
 */

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
// Lot 5.20-B — distances estimées à 1 décimale (chiffres tabulaires côté carte).
const km1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Libellé de délai signé : retard (+), avance (−) ou à l'heure. */
function delaiLabel(min: number): string {
  if (min === 0) return "à l'heure";
  if (min > 0) return `+${min} min`;
  return `${min} min`;
}
// Lot 5.20-E — coût/km à 2-3 décimales (le €/km est fin).
const km2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });

// Titre de tier (zone majeure) et libellé de sous-groupe (discret) — hiérarchie
// visuelle : un `h2` par tier, des libellés non-titres pour les sous-groupes
// (l'ossature de titres reste h1 → h2 tiers → h3 cartes).
const TIER_TITLE_CLASS = 'text-foreground text-sm font-semibold uppercase tracking-wide';
const GROUP_LABEL_CLASS = 'text-muted-foreground text-xs font-semibold uppercase tracking-wide';

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
    <div className="space-y-16">
      <PageHeader
        title="Tableau de bord"
        description={<>Vue d&apos;ensemble de votre activité · {periode}</>}
        actions={<ExportStatsButton />}
      />

      {/* ═══════════════ TIER 1 — L'ESSENTIEL ═══════════════
          Scorecard de tête (pyramide inversée / scan F) : le vital d'abord, le
          plus critique en HAUT-GAUCHE. 3 KPI hero (CA encaissé → encours →
          courses à facturer) répondent à « où en est-on ? » d'un coup d'œil ;
          la couleur ne marque que le statut (seuil). Puis les actionnables. */}
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

      {/* ═══════════════ TIER 2 — ACTIVITÉ & PILOTAGE ═══════════════
          Les drivers qui expliquent le Tier 1 : volume, no-show (statut), panier,
          activité du jour, effectifs — en taille normal. Puis le prévisionnel /
          réalisation. « Aujourd'hui » + « Volume du mois » couvrent le J/S/M
          (l'ancienne section « Courses par période » redondante est supprimée). */}
      <section className="space-y-8" aria-labelledby="tier-activite">
        <h2 id="tier-activite" className={TIER_TITLE_CLASS}>
          Activité &amp; pilotage
        </h2>
        <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
          <KpiCard
            variant="simple"
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
            label="Panier moyen / course"
            value={eur.format(panierMoyen)}
            context={`sur ${data.caMois.count} course${data.caMois.count > 1 ? 's' : ''} encaissée${
              data.caMois.count > 1 ? 's' : ''
            }`}
          />
          <KpiCard
            variant="simple"
            label="Aujourd'hui"
            value={String(data.volume.aujourdhui)}
            context={`7 derniers jours : ${data.volume.semaine}`}
          />
          <KpiCard
            variant="simple"
            label="Chauffeurs"
            value={`${data.chauffeurs.actifsAvecCourse} / ${data.chauffeurs.totalActifs}`}
            context={`actifs aujourd'hui · ~${data.chauffeurs.moyenneParChauffeur}/chauffeur`}
          />
        </div>

        <div className="space-y-4">
          <p className={GROUP_LABEL_CLASS}>Prévisionnel &amp; réalisation</p>
          <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <KpiCard
              variant="simple"
              size="compact"
              label="À venir aujourd'hui"
              value={eur.format(data.previsionnel.aVenirJour)}
            />
            <KpiCard
              variant="simple"
              size="compact"
              label="À venir 7 jours"
              value={eur.format(data.previsionnel.aVenirSemaine)}
            />
            <KpiCard
              variant="simple"
              size="compact"
              label="À venir ce mois"
              value={eur.format(data.previsionnel.aVenirMois)}
            />
            <KpiCard
              variant="simple"
              size="compact"
              label="À venir cette année"
              value={eur.format(data.previsionnel.aVenirAnnee)}
            />
            <KpiCard
              variant="simple"
              size="compact"
              label="Réalisation du mois"
              value={
                data.previsionnel.planifieMois > 0 ? `${data.previsionnel.tauxRealisation} %` : '—'
              }
              context={
                data.previsionnel.planifieMois > 0
                  ? `${eur.format(data.previsionnel.realiseMois)} réalisé / ${eur.format(
                      data.previsionnel.planifieMois,
                    )} planifié${
                      data.previsionnel.ridesMoisValorisees < data.previsionnel.ridesMoisTotal
                        ? ` · ${data.previsionnel.ridesMoisValorisees}/${data.previsionnel.ridesMoisTotal} valorisées`
                        : ''
                    }`
                  : 'Aucune course planifiée ce mois'
              }
            />
          </div>
          <p className="text-muted-foreground text-xs">
            Prévu = valeur tarifaire des courses planifiées (tarifs déjà calculés). Les occurrences
            de récurrence non encore créées ne sont pas projetées.
          </p>
        </div>
      </section>

      {/* ═══════════════ TIER 3 — DÉTAIL & DIAGNOSTIC ═══════════════
          Pour qui veut creuser : opérationnel, distance/délai, économie, tops,
          conformité — en `compact`, regroupés par sous-thème (libellés discrets,
          non-titres). REPLIABLE (native `<details>`, ouvert par défaut) pour
          alléger la surface visible sans masquer de donnée. Les garde-fous
          d'honnêteté restent affichés. */}
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

        {/* Opérationnel (Lot 5.20-A) — « Non disponible » si aucune course. */}
        <div className="space-y-4">
          <p className={GROUP_LABEL_CLASS}>Opérationnel</p>
          <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              variant="simple"
              size="compact"
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
              size="compact"
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
              size="compact"
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
              size="compact"
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
        </div>

        {/* Distance & délai estimés (Lot 5.20-B) — libellé « estimé » explicite. */}
        <div className="space-y-4">
          <p className={GROUP_LABEL_CLASS}>Distance &amp; délai (estimés)</p>
          <div className="grid grid-cols-1 items-stretch gap-8 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              variant="simple"
              size="compact"
              label="Km moyen / course"
              value={
                data.distanceDelai.ridesAvecDistance > 0
                  ? `${km1.format(data.distanceDelai.kmMoyenParCourse)} km`
                  : '—'
              }
              context={
                data.distanceDelai.ridesAvecDistance > 0
                  ? `estimé (facteur routier 1,3) · sur ${data.distanceDelai.ridesAvecDistance}/${data.distanceDelai.ridesRealisees} course${
                      data.distanceDelai.ridesRealisees > 1 ? 's' : ''
                    } géolocalisée${data.distanceDelai.ridesAvecDistance > 1 ? 's' : ''}`
                  : 'Aucune course géolocalisée ce mois'
              }
            />
            <KpiCard
              variant="simple"
              size="compact"
              label="Km à vide / en charge"
              value={
                data.distanceDelai.kmEnChargeTotal > 0
                  ? `${data.distanceDelai.ratioAVidePct} %`
                  : '—'
              }
              context={
                data.distanceDelai.kmEnChargeTotal > 0
                  ? `${km1.format(data.distanceDelai.kmAVideTotal)} km à vide · ${km1.format(
                      data.distanceDelai.kmEnChargeTotal,
                    )} km en charge (estimés)`
                  : 'Non disponible'
              }
            />
            <KpiCard
              variant="simple"
              size="compact"
              label="Délai moyen de prise en charge"
              value={
                data.distanceDelai.ridesAvecDelai > 0
                  ? delaiLabel(data.distanceDelai.delaiMoyenMin)
                  : '—'
              }
              context={
                data.distanceDelai.ridesAvecDelai > 0
                  ? `sur ${data.distanceDelai.ridesAvecDelai} course${
                      data.distanceDelai.ridesAvecDelai > 1 ? 's' : ''
                    } démarrée${data.distanceDelai.ridesAvecDelai > 1 ? 's' : ''} · écart programmé/réel`
                  : 'Aucune course démarrée ce mois'
              }
            />
          </div>
        </div>

        {/* Économie estimée (Lot 5.20-E) — « Non configuré » sans paramètres. */}
        <div className="space-y-4">
          <p className={GROUP_LABEL_CLASS}>Économie (estimée)</p>
          {!data.economique.configured ? (
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
                value={`${km2.format(data.economique.coutParKm)} €/km`}
                context="Carburant + entretien + amortissement (paramétré)"
              />
              <KpiCard
                variant="simple"
                size="compact"
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
                size="compact"
                label="Rentabilité mutualisées"
                value={eur.format(data.economique.margeMutualisees)}
                context="Marge estimée sur courses mutualisées"
              />
              <KpiCard
                variant="simple"
                size="compact"
                label="Rentabilité non mutualisées"
                value={eur.format(data.economique.margeNonMutualisees)}
                context="Marge estimée hors mutualisation"
              />
            </div>
          )}
          {data.economique.configured ? (
            <p className="text-muted-foreground text-xs">
              Marge estimée (coût/km paramétré × distance estimée). Courses sans coordonnées
              exclues.{' '}
              <Link href="/admin/parametres-couts" className="underline">
                Modifier les coûts
              </Link>
            </p>
          ) : null}
        </div>

        {/* Prescriptions & tops commerciaux (DEC-164/165) — pas de top patients. */}
        <div className="space-y-4">
          <p className={GROUP_LABEL_CLASS}>Prescriptions &amp; tops commerciaux</p>
          <div className="grid items-stretch gap-8 lg:grid-cols-2">
            <PrescriptionsCard prescriptions={data.prescriptions} />
            <CommercialTopsCard commercial={data.commercial} />
          </div>
        </div>

        {/* Conformité & échéances. */}
        <div className="space-y-4">
          <p className={GROUP_LABEL_CLASS}>Conformité &amp; échéances</p>
          <div className="grid items-stretch gap-8 lg:grid-cols-2">
            <ComplianceCard conformite={data.conformite} />
            <ComplianceAlertsPanel alerts={complianceAlerts} variant="card" limit={5} />
          </div>
        </div>
      </details>
    </div>
  );
}
