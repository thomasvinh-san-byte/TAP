import { Users, Building2 } from 'lucide-react';
import type { DashboardCommercial } from '../_lib/queries-dashboard';

/**
 * Carte tops commerciaux (CdG §5.20 l.502/504, DEC-165) — Top 10 patients +
 * Top 5 donneurs d'ordres B2B par CA encaissé du mois. Lecture seule, server
 * component. CA = même définition que `getCaMois` (les tops partitionnent le CA
 * mensuel). Montants en euros (chiffres tabulaires).
 */
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function CommercialTopsCard({
  commercial,
}: {
  commercial: DashboardCommercial;
}): JSX.Element {
  const { topPatients, topDonneurs } = commercial;

  return (
    <section className="border-border bg-background flex h-full flex-col gap-16 rounded-lg border p-16">
      <div>
        <div className="mb-8 flex items-center gap-8">
          <Users className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
          <h3 className="text-sm font-medium">Top patients (CA du mois)</h3>
        </div>
        {topPatients.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune course encaissée ce mois.</p>
        ) : (
          <ol className="space-y-4">
            {topPatients.map((p, i) => (
              <li key={p.patient_id} className="flex items-center justify-between gap-12 text-sm">
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground tabular-nums">{i + 1}.</span> {p.label}
                  <span className="text-muted-foreground"> · {p.count}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums">{eur.format(p.ca_eur)}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="border-border border-t pt-12">
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
    </section>
  );
}
