import { FileText } from 'lucide-react';
import type { DashboardPrescriptions } from '../_lib/queries-dashboard';

/**
 * Carte KPIs prescriptions / bons de transport (CdG §5.4/§5.20, DEC-164).
 *
 * Lecture seule, server component. Deux sections : bons par statut (avec mise en
 * évidence des bons à risque = épuisés + expirés) + Top 5 prescripteurs. Mêmes
 * chiffres que les alertes prescriptions du cockpit (même source, 07.06).
 */
export function PrescriptionsCard({
  prescriptions,
}: {
  prescriptions: DashboardPrescriptions;
}): JSX.Element {
  const { bonsActifs, bonsProchesSeuil, bonsEpuises, bonsExpires, topPrescripteurs } =
    prescriptions;
  const aRisque = bonsEpuises + bonsExpires;

  return (
    <section className="border-border bg-card shadow-elev-sm flex h-full flex-col gap-12 rounded-lg border p-16">
      <div className="flex items-center gap-8">
        <FileText className="text-muted-foreground h-16 w-16 shrink-0" aria-hidden />
        <h3 className="text-sm font-medium">Prescriptions / bons de transport</h3>
      </div>

      <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
        <Stat label="Actifs" value={bonsActifs} />
        <Stat
          label="Proches seuil (80 %)"
          value={bonsProchesSeuil}
          tone={bonsProchesSeuil > 0 ? 'warn' : 'neutral'}
        />
        <Stat label="Épuisés" value={bonsEpuises} tone={bonsEpuises > 0 ? 'danger' : 'neutral'} />
        <Stat label="Expirés" value={bonsExpires} tone={bonsExpires > 0 ? 'danger' : 'neutral'} />
      </div>

      {aRisque > 0 && (
        <p className="text-destructive text-xs">
          {aRisque} bon{aRisque > 1 ? 's' : ''} à régulariser (épuisé{aRisque > 1 ? 's' : ''} ou
          expiré{aRisque > 1 ? 's' : ''}).
        </p>
      )}

      <div className="border-border mt-4 border-t pt-12">
        <h4 className="text-muted-foreground mb-8 text-xs font-semibold uppercase tracking-wide">
          Top prescripteurs
        </h4>
        {topPrescripteurs.length === 0 ? (
          <p className="text-muted-foreground text-sm">Aucune prescription enregistrée.</p>
        ) : (
          <ol className="space-y-4">
            {topPrescripteurs.map((p, i) => (
              <li
                key={p.prescriber_id}
                className="flex items-center justify-between gap-12 text-sm"
              >
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground tabular-nums">{i + 1}.</span> {p.label}
                </span>
                <span className="font-medium tabular-nums">
                  {p.count} bon{p.count > 1 ? 's' : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'warn' | 'danger';
}): JSX.Element {
  const valueClass =
    tone === 'danger' ? 'text-destructive' : tone === 'warn' ? 'text-amber-600' : 'text-foreground';
  return (
    <div className="space-y-2">
      <div className={`text-xl font-semibold tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-muted-foreground text-xs">{label}</div>
    </div>
  );
}
