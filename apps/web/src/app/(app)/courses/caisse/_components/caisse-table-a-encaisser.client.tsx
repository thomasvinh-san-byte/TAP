'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Wallet, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import { cn } from '@/lib/utils';
import { RidePaymentPopover } from '../../_components/ride-payment-popover.client';
import { markRideReminderAction } from '../../actions';
import type { CaisseRow } from '../_lib/queries-caisse';

/**
 * CaisseTableAEncaisser (CAISSE-01) — courses terminées restant à encaisser,
 * outil de recouvrement. Créances triées par ancienneté (plus vieilles d'abord).
 * Chaque ligne montre l'ANCIENNETÉ de la créance (repère gradué sobre, texte +
 * couleur réservée aux seuils) pour prioriser, et permet de tracer une RELANCE
 * (champ dédié `payment_reminded_at`). L'encaissement (bouton + popover) est
 * inchangé : au succès la course bascule `encaisse` et disparaît de la vue.
 */

function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDayMonth(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
}

/** Ancienneté en jours entiers (>= 0) depuis la fin de course. */
function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function formatAnciennete(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  return `il y a ${days} j`;
}

// Seuils sobres : neutre < 8 j, attention 8–30 j, alerte > 30 j. La couleur ne
// fait que renforcer le texte (accessibilité / daltonisme : l'âge reste lisible).
function ancienneteClass(days: number): string {
  if (days > 30) return 'text-destructive font-medium';
  if (days >= 8) return 'text-warning';
  return 'text-muted-foreground';
}

/** Cellule d'ancienneté : pastille de seuil + âge en clair. */
function AncienneteCell({ endedAt }: { endedAt: string | null }): JSX.Element {
  if (!endedAt) return <span className="text-muted-foreground">—</span>;
  const days = daysSince(endedAt);
  const cls = ancienneteClass(days);
  return (
    <span className={cn('inline-flex items-center gap-8 text-sm tabular-nums', cls)}>
      <span className="h-8 w-8 shrink-0 rounded-full bg-current" aria-hidden />
      {formatAnciennete(days)}
    </span>
  );
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

/**
 * Marquage de relance (traçabilité recouvrement). Jamais relancé → bouton
 * « Relancer » ; relancé → « Relancé le JJ/MM » + relance à nouveau possible.
 * N'encaisse pas : la créance reste dans la vue.
 */
function RelanceRowAction({
  rideId,
  remindedAt,
}: {
  rideId: string;
  remindedAt: string | null;
}): JSX.Element {
  const router = useRouter();
  const [reminded, setReminded] = React.useState<string | null>(remindedAt);
  const [pending, startTransition] = React.useTransition();

  function relancer(): void {
    startTransition(async () => {
      const res = await markRideReminderAction({ rideId });
      if (res.success) {
        setReminded(new Date().toISOString());
        router.refresh();
      }
    });
  }

  if (reminded) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-8 text-xs">
        Relancé le {formatDayMonth(reminded)}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={relancer}
          disabled={pending}
          aria-label="Relancer à nouveau"
        >
          <BellRing className="h-12 w-12" aria-hidden />
        </Button>
      </span>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={relancer}
      disabled={pending}
      className="gap-4"
    >
      <BellRing className="h-12 w-12" aria-hidden />
      Relancer
    </Button>
  );
}

const COLUMNS: DataTableColumn<CaisseRow>[] = [
  {
    key: 'date',
    header: 'Réalisée le',
    width: '120px',
    cell: (r) => (
      <span className="tabular-nums">{formatDateTime(r.ended_at ?? r.scheduled_at)}</span>
    ),
  },
  {
    key: 'anciennete',
    header: 'Ancienneté',
    width: '130px',
    cell: (r) => <AncienneteCell endedAt={r.ended_at} />,
  },
  {
    key: 'patient',
    header: 'Patient',
    cell: (r) => `${r.patient_nom} ${r.patient_prenom}`.trim() || '—',
  },
  {
    key: 'driver',
    header: 'Chauffeur',
    width: '180px',
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
    key: 'relance',
    header: 'Relance',
    width: '160px',
    align: 'right',
    cell: (r) => <RelanceRowAction rideId={r.id} remindedAt={r.payment_reminded_at} />,
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
            colSpan={4}
            className="text-muted-foreground px-12 py-12 text-right text-sm font-semibold uppercase tracking-wide"
          >
            Total à encaisser
          </td>
          <td className="px-12 py-12 text-right font-mono text-sm font-semibold tabular-nums">
            {formatEur(total)}
          </td>
          <td className="px-12 py-12" colSpan={2} />
        </tr>
      }
    />
  );
}
