'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState as SharedEmptyState } from '@/components/ui/empty-state';
import { DataTable, Pagination } from '@/components/data-table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { archiveOrderingPartyAction } from '../actions';
import type { OrderingPartyRow } from '../page';
import { OrderingPartyForm } from './ordering-party-form.client';

interface Props {
  initialParties: OrderingPartyRow[];
}

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; party: OrderingPartyRow };

const MODALITE_LABELS: Record<OrderingPartyRow['modalite_facturation'], string> = {
  a_la_course: 'À la course',
  hebdomadaire: 'Hebdomadaire',
  mensuelle: 'Mensuelle',
};

export function OrderingPartiesList({ initialParties }: Props): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>({ kind: 'closed' });
  const [archiveTarget, setArchiveTarget] = React.useState<OrderingPartyRow | null>(null);
  const [page, setPage] = React.useState(0);

  const PAGE_SIZE = 50;
  const pagedParties = initialParties.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const close = React.useCallback(() => setMode({ kind: 'closed' }), []);

  const onSuccess = React.useCallback(() => {
    close();
    router.refresh();
  }, [close, router]);

  const onArchive = async () => {
    if (!archiveTarget) return;
    const res = await archiveOrderingPartyAction(archiveTarget.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Donneur d'ordres archivé.");
    setArchiveTarget(null);
    close();
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {initialParties.length} donneur{initialParties.length > 1 ? 's' : ''} d&apos;ordres
        </p>
        <Button
          type="button"
          variant="accent"
          onClick={() => setMode({ kind: 'create' })}
          className="gap-8"
        >
          <Plus className="h-16 w-16" aria-hidden />
          Nouveau donneur d&apos;ordres
        </Button>
      </div>

      <DataTable<OrderingPartyRow>
        columns={[
          {
            key: 'raison_sociale',
            header: 'Donneur d’ordres',
            cell: (p) => (
              <div className="flex items-center gap-12">
                <div className="bg-muted text-muted-foreground flex h-32 w-32 shrink-0 items-center justify-center rounded-md">
                  <Building2 className="h-16 w-16" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{p.raison_sociale}</div>
                  <div className="text-muted-foreground truncate text-xs tabular-nums">
                    {p.siret || 'SIRET non renseigné'}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: 'contact',
            header: 'Contact',
            width: '220px',
            cell: (p) =>
              p.contact_principal_nom || p.contact_principal_telephone ? (
                <div className="min-w-0">
                  <div className="truncate text-sm">{p.contact_principal_nom || '—'}</div>
                  {p.contact_principal_telephone && (
                    <div className="text-muted-foreground truncate text-xs tabular-nums">
                      {p.contact_principal_telephone}
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              ),
          },
          {
            key: 'modalite',
            header: 'Facturation',
            width: '160px',
            cell: (p) => (
              <Badge variant="secondary" className="text-xs">
                {MODALITE_LABELS[p.modalite_facturation]}
              </Badge>
            ),
          },
          {
            key: 'actif',
            header: 'Statut',
            width: '120px',
            cell: (p) =>
              p.actif ? <Badge>Actif</Badge> : <Badge variant="outline">Inactif</Badge>,
          },
        ]}
        rows={pagedParties}
        // DEC-033 : clé inclut `actif` pour re-mount au changement.
        rowKey={(p) => `${p.id}-${p.actif}`}
        ariaLabel="Liste des donneurs d'ordres B2B"
        onRowClick={(p) => setMode({ kind: 'edit', party: p })}
        emptyState={<EmptyState onCreate={() => setMode({ kind: 'create' })} />}
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={initialParties.length}
        onPageChange={setPage}
      />

      <Sheet
        open={mode.kind !== 'closed'}
        onOpenChange={(o) => {
          if (!o) close();
        }}
      >
        <SheetContent
          side="right"
          className="flex w-[480px] flex-col gap-0 p-0 sm:w-[480px] sm:max-w-[480px]"
        >
          <SheetHeader className="border-border shrink-0 border-b px-24 py-16 text-left">
            <SheetTitle>
              {mode.kind === 'edit' ? 'Modifier le donneur d’ordres' : 'Nouveau donneur d’ordres'}
            </SheetTitle>
            <SheetDescription>
              Proposé au rattachement d&apos;une course (champ optionnel).
            </SheetDescription>
          </SheetHeader>

          {mode.kind === 'create' && <OrderingPartyForm onSuccess={onSuccess} onCancel={close} />}
          {mode.kind === 'edit' && (
            <OrderingPartyForm
              initial={mode.party}
              onSuccess={onSuccess}
              onCancel={close}
              onArchive={() => setArchiveTarget(mode.party)}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={archiveTarget !== null}
        onOpenChange={(o) => {
          if (!o) setArchiveTarget(null);
        }}
      >
        <SheetContent side="bottom" className="space-y-16 p-24">
          <SheetHeader>
            <SheetTitle>Archiver « {archiveTarget?.raison_sociale} » ?</SheetTitle>
            <SheetDescription>
              Le donneur d&apos;ordres ne sera plus proposé au rattachement d&apos;une course. Les
              courses passées restent intactes.
            </SheetDescription>
          </SheetHeader>
          <div className="flex justify-end gap-12">
            <Button type="button" variant="outline" onClick={() => setArchiveTarget(null)}>
              Conserver
            </Button>
            <Button type="button" variant="destructive" onClick={() => void onArchive()}>
              Archiver
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <SharedEmptyState
      icon={Building2}
      title="Aucun donneur d'ordres enregistré"
      description="Ajoutez les établissements (hôpitaux, cliniques, EHPAD) qui commandent des transports pour leurs patients."
      action={{
        onClick: onCreate,
        label: "Ajouter un donneur d'ordres",
        icon: Plus,
        variant: 'accent',
      }}
    />
  );
}
