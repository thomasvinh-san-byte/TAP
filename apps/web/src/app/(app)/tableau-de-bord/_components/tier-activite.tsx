import type { DashboardData } from '../_lib/queries-dashboard';
import { deltaPercent, deltaPoints } from '../_lib/delta';
import { KpiCard } from './kpi-card';
import {
  TIER_TITLE_CLASS,
  GROUP_LABEL_CLASS,
  eur,
  tauxState,
  moisEnClair,
  previousMonthOf,
} from './dashboard-shared';

/**
 * Tier 2 « Activité & pilotage » — les drivers qui expliquent le Tier 1 :
 * volume, no-show (statut), panier, activité du jour, effectifs (taille normal).
 * Puis le sous-groupe prévisionnel / réalisation. « Aujourd'hui » + « Volume du
 * mois » couvrent le J/S/M.
 *
 * Iso-fonctionnel : extrait de `page.tsx` sans changement de rendu ni de calcul.
 */
export function TierActivite({ data }: { data: DashboardData }): JSX.Element {
  const moisPrecLibelle = moisEnClair(previousMonthOf(data.moisCourant));
  const taux = tauxState(data.incidents.taux);
  const volDelta = deltaPercent(data.volume.mois, data.volMoisPrec);
  const incidentsDelta = deltaPoints(data.incidents.taux, data.incidentsPrec.taux);

  // DEC-166 — Panier moyen / course (CdG §5.20 l.501) : DÉRIVÉ, pas de requête.
  // Périmètre COHÉRENT : CA encaissé ÷ courses encaissées (caMois.count = nombre
  // de courses terminées+encaissées, même ensemble que caMois.total_eur).
  const panierMoyen = data.caMois.count > 0 ? data.caMois.total_eur / data.caMois.count : 0;

  return (
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
          Prévu = valeur tarifaire des courses planifiées (tarifs déjà calculés). Les occurrences de
          récurrence non encore créées ne sont pas projetées.
        </p>
      </div>
    </section>
  );
}
