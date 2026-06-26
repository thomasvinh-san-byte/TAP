'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TariffGridRow } from '../page';
import { TariffEditSheet } from './tariff-edit-sheet.client';

function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function formatDateFr(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function TariffGridCard({ grid }: { grid: TariffGridRow }): JSX.Element {
  const [editOpen, setEditOpen] = useState(false);

  const rows: { label: string; value: string }[] = [
    { label: 'Forfait prise en charge', value: formatEur(grid.forfait_eur) },
    { label: 'Km inclus dans le forfait', value: `${grid.km_inclus} km` },
    { label: 'Prix au km (974)', value: `${formatEur(grid.prix_km_eur)}/km` },
    { label: 'Supplément DROM', value: formatEur(grid.supplement_drom_eur) },
    { label: 'Supplément TPMR', value: formatEur(grid.supplement_tpmr_eur) },
    {
      label: 'Supplément accompagnant',
      value: formatEur(grid.supplement_accompagnant_eur ?? 0),
    },
    { label: 'Majoration nuit/we/férié', value: `${grid.majoration_pct} %` },
    {
      label: 'Facteur de correction routier',
      value: grid.facteur_correction_routier.toFixed(2).replace('.', ','),
    },
  ];

  return (
    <article className="border-border bg-muted/20 rounded-md border p-16">
      <header className="mb-12 flex items-start justify-between gap-12">
        <div>
          <h2 className="text-foreground text-base font-semibold">Grille active</h2>
          <p className="text-muted-foreground text-xs">
            En vigueur depuis le {formatDateFr(grid.date_effet)}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil aria-hidden className="mr-8 h-12 w-12" />
          Modifier la grille
        </Button>
      </header>

      <dl className="space-y-6 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-mono tabular-nums">{row.value}</dd>
          </div>
        ))}
      </dl>

      <TariffEditSheet open={editOpen} onOpenChange={setEditOpen} current={grid} />
    </article>
  );
}
