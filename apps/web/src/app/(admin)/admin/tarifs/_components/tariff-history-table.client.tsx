'use client';

import type { TariffGridRow } from '../page';

function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function formatDateFr(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function TariffHistoryTable({
  grids,
  activeId,
}: {
  grids: TariffGridRow[];
  activeId: string;
}): JSX.Element {
  return (
    <section className="space-y-12">
      <h2 className="text-muted-foreground text-sm font-semibold uppercase tracking-wide">
        Historique des grilles
      </h2>
      <div className="border-border bg-background overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse">
          <thead className="bg-muted/40">
            <tr className="border-border text-muted-foreground h-10 border-b text-xs uppercase tracking-wide">
              <th className="px-12 text-left font-medium">Date d&apos;effet</th>
              <th className="px-12 text-left font-medium">Forfait</th>
              <th className="px-12 text-left font-medium">Km 974</th>
              <th className="px-12 text-left font-medium">DROM</th>
              <th className="px-12 text-left font-medium">TPMR</th>
              <th className="px-12 text-left font-medium">Majo</th>
              <th className="px-12 text-left font-medium">Statut</th>
            </tr>
          </thead>
          <tbody>
            {grids.map((g) => {
              const isActive = g.id === activeId;
              return (
                <tr
                  key={g.id}
                  className={
                    'border-border h-10 border-b text-sm ' + (isActive ? 'bg-muted/30' : '')
                  }
                >
                  <td className="px-12 tabular-nums">{formatDateFr(g.date_effet)}</td>
                  <td className="px-12 font-mono tabular-nums">{formatEur(g.forfait_eur)}</td>
                  <td className="px-12 font-mono tabular-nums">{formatEur(g.prix_km_eur)}</td>
                  <td className="px-12 font-mono tabular-nums">
                    {formatEur(g.supplement_drom_eur)}
                  </td>
                  <td className="px-12 font-mono tabular-nums">
                    {formatEur(g.supplement_tpmr_eur)}
                  </td>
                  <td className="px-12 font-mono tabular-nums">{g.majoration_pct} %</td>
                  <td className="px-12">
                    {isActive ? (
                      <span className="text-xs font-semibold text-emerald-700">Active</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Archivée</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
