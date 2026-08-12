import { Building2, Stethoscope } from 'lucide-react';
import type { DashboardCommercial } from '../_lib/queries-dashboard';

/**
 * Carte tops commerciaux du mois (CdG §5.20 l.502/504, DEC-165 + Lot 5.20-C).
 * Lecture seule, server component. Deux classements d'ENTITÉS B2B (jamais de
 * patients — KPI-01) :
 *   - Top 5 donneurs d'ordres par CA encaissé (CA = même définition que
 *     `getCaMois` → les tops partitionnent le CA mensuel) ;
 *   - Top 5 prescripteurs par ACTIVITÉ (nombre de courses du mois).
 * Montants et comptes en chiffres tabulaires.
 */
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function CommercialTopsCard({
  commercial,
}: {
  commercial: DashboardCommercial;
}): JSX.Element {
  const { topDonneurs, topPrescripteursActivite } = commercial;

  return (
    <section className="border-border bg-card shadow-elev-sm flex h-full flex-col gap-16 rounded-lg border p-16">
      <div>
        <div className="mb-8 flex items-center gap-8">
          <Building2 className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
          <h3 className="text-sm font-medium">Top donneurs d&apos;ordres (CA du mois)</h3>
        </div>
        {topDonneurs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucun CA donneur d&apos;ordres ce mois.</p>
        ) : (
          <ol className="space-y-4">
            {topDonneurs.map((d, i) => (
              <li
                key={d.ordering_party_id}
                className="flex items-center justify-between gap-12 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground tabular-nums">{i + 1}.</span> {d.label}
                  <span className="text-muted-foreground"> · {d.count}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">{eur.format(d.ca_eur)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="border-border border-t pt-16">
        <div className="mb-8 flex items-center gap-8">
          <Stethoscope className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
          <h3 className="text-sm font-medium">Top prescripteurs (courses du mois)</h3>
        </div>
        {topPrescripteursActivite.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune course rattachée à un bon ce mois.</p>
        ) : (
          <ol className="space-y-4">
            {topPrescripteursActivite.map((p, i) => (
              <li
                key={p.prescriber_id}
                className="flex items-center justify-between gap-12 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground tabular-nums">{i + 1}.</span> {p.label}
                </span>
                <span className="shrink-0 font-medium tabular-nums">
                  {p.count} course{p.count > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
