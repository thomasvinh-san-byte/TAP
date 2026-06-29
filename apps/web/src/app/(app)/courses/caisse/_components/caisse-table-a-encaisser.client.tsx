'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { RidePaymentPopover } from '../../_components/ride-payment-popover.client';
import type { CaisseRow } from '../_lib/queries-caisse';

/**
 * CaisseTableAEncaisser (CAISSE-01) — courses terminées restant à encaisser.
 * Frère de `CaisseTable` (journal encaissé), distinct car la sémantique diffère :
 * pas de mode de paiement (la course n'en a pas encore), une action « Encaisser »
 * par ligne réutilisant le `RidePaymentPopover` existant. Au succès, la course
 * bascule `encaisse` et disparaît de la vue (revalidation + refresh).
 */

function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Bouton + popover d'encaissement pour une ligne (état local par ride). */
function EncaisserRowAction({
  rideId,
  amount,
}: {
  rideId: string;
  amount: number | null;
}): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button type="button" size="sm" variant="accent" onClick={() => setOpen(true)}>
        Encaisser
      </Button>
      <RidePaymentPopover
        rideId={rideId}
        defaultAmountEur={amount}
        open={open}
        onOpenChange={setOpen}
        onDone={() => router.refresh()}
      />
    </>
  );
}

const COLUMNS: DataTableColumn<CaisseRow>[] = [
  {
    key: 'date',
    header: 'Réalisée le',
    width: '140px',
    cell: (r) => (
      <span className="tabular-nums">{formatDateTime(r.ended_at ?? r.scheduled_at)}</span>
    ),
  },
  {
    key: 'patient',
    header: 'Patient',
    cell: (r) => `${r.patient_nom} ${r.patient_prenom}`.trim() || '—',
  },
  {
    key: 'driver',
    header: 'Chauffeur',
    width: '200px',
    cell: (r) =>
      r.driver_nom ? (
        <div className="flex items-center gap-8">
          <InitialsAvatar name={r.driver_nom} role="chauffeur" size={24} />
          <span className="truncate">{r.driver_nom}</span>
        </div>
      ) : (
        '—'
      ),
  },
  {
    key: 'tarif',
    header: 'Montant attendu',
    width: '140px',
    align: 'right',
    cell: (r) => (
      <span className="font-mono tabular-nums">{formatEur(Number(r.tarif_amount_eur ?? 0))}</span>
    ),
  },
  {
    key: 'action',
    header: '',
    width: '140px',
    align: 'right',
    cell: (r) => <EncaisserRowAction rideId={r.id} amount={r.tarif_amount_eur} />,
  },
];

export function CaisseTableAEncaisser({ rows }: { rows: CaisseRow[] }): JSX.Element {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="Rien à encaisser"
        description="Aucune course terminée en attente d'encaissement direct."
      />
    );
  }

  const total = rows.reduce((acc, r) => acc + Number(r.tarif_amount_eur ?? 0), 0);

  return (
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      ariaLabel="Courses à encaisser"
      footer={
        <tr>
          <td
            colSpan={3}
            className="text-muted-foreground px-12 py-12 text-right text-sm font-semibold uppercase tracking-wide"
          >
            Total à encaisser
          </td>
          <td className="px-12 py-12 text-right font-mono text-sm font-semibold tabular-nums">
            {formatEur(total)}
          </td>
          <td className="px-12 py-12" />
        </tr>
      }
    />
  );
}
