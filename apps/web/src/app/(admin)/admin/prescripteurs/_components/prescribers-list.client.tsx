'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Stethoscope, Building2, Plus } from 'lucide-react';
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
import { archivePrescriberAction } from '../actions';
import type { PrescriberRow } from '../page';
import { PrescriberForm } from './prescriber-form.client';

interface Props {
  initialPrescribers: PrescriberRow[];
}

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; prescriber: PrescriberRow };

const PAGE_SIZE = 50;

function fullName(p: PrescriberRow): string {
  return [p.nom, p.prenom].filter(Boolean).join(' ');
}

export function PrescribersList({ initialPrescribers }: Props): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>({ kind: 'closed' });
  const [archiveTarget, setArchiveTarget] = React.useState<PrescriberRow | null>(null);
  const [page, setPage] = React.useState(0);

  const paged = initialPrescribers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const close = React.useCallback(() => setMode({ kind: 'closed' }), []);
  const onSuccess = React.useCallback(() => {
    close();
    router.refresh();
  }, [close, router]);

  const onArchive = async () => {
    if (!archiveTarget) return;
    const res = await archivePrescriberAction(archiveTarget.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Prescripteur archivé.');
    setArchiveTarget(null);
    close();
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {initialPrescribers.length} prescripteur{initialPrescribers.length > 1 ? 's' : ''}
        </p>
        <Button
          type="button"
          variant="accent"
          onClick={() => setMode({ kind: 'create' })}
          className="gap-8"
        >
          <Plus className="h-16 w-16" aria-hidden />
          Nouveau prescripteur
        </Button>
      </div>

      <DataTable<PrescriberRow>
        columns={[
          {
            key: 'nom',
            header: 'Prescripteur',
            cell: (p) => (
              <div className="flex items-center gap-12">
                <div className="bg-muted text-muted-foreground flex h-32 w-32 shrink-0 items-center justify-center rounded-md">
                  {p.type === 'etablissement' ? (
                    <Building2 className="h-16 w-16" aria-hidden />
                  ) : (
                    <Stethoscope className="h-16 w-16" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{fullName(p)}</div>
                  <div className="text-muted-foreground truncate text-xs tabular-nums">
                    {p.rpps
                      ? `RPPS ${p.rpps}`
                      : p.finess
                        ? `FINESS ${p.finess}`
                        : p.adeli
                          ? `ADELI ${p.adeli}`
                          : 'Identifiant non renseigné'}
                  </div>
                </div>
              </div>
            ),
          },
          {
            key: 'type',
            header: 'Type',
            width: '140px',
            cell: (p) => (
              <Badge variant="secondary" className="text-xs">
                {p.type === 'etablissement' ? 'Établissement' : 'Médecin'}
              </Badge>
            ),
          },
          {
            key: 'specialite',
            header: 'Spécialité',
            width: '180px',
            cell: (p) => (
              <span className={p.specialite ? 'text-sm' : 'text-muted-foreground text-xs'}>
                {p.specialite || '—'}
              </span>
            ),
          },
          {
            key: 'contact',
            header: 'Contact',
            width: '200px',
            cell: (p) =>
              p.contact_telephone || p.contact_email ? (
                <div className="min-w-0">
                  {p.contact_telephone && (
                    <div className="truncate text-sm tabular-nums">{p.contact_telephone}</div>
                  )}
                  {p.contact_email && (
                    <div className="text-muted-foreground truncate text-xs">{p.contact_email}</div>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
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
        rows={paged}
        rowKey={(p) => `${p.id}-${p.actif}`}
        ariaLabel="Liste des prescripteurs"
        onRowClick={(p) => setMode({ kind: 'edit', prescriber: p })}
        emptyState={<EmptyState onCreate={() => setMode({ kind: 'create' })} />}
      />

      <Pagination
        page={page}
        pageSize={PAGE_SIZE}
        total={initialPrescribers.length}
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
              {mode.kind === 'edit' ? 'Modifier le prescripteur' : 'Nouveau prescripteur'}
            </SheetTitle>
            <SheetDescription>
              Médecin ou établissement émetteur des prescriptions de transport.
            </SheetDescription>
          </SheetHeader>

          {mode.kind === 'create' && <PrescriberForm onSuccess={onSuccess} onCancel={close} />}
          {mode.kind === 'edit' && (
            <PrescriberForm
              initial={mode.prescriber}
              onSuccess={onSuccess}
              onCancel={close}
              onArchive={() => setArchiveTarget(mode.prescriber)}
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
            <SheetTitle>Archiver « {archiveTarget ? fullName(archiveTarget) : ''} » ?</SheetTitle>
            <SheetDescription>
              Le prescripteur ne sera plus proposé. Les prescriptions passées restent intactes.
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
      icon={Stethoscope}
      title="Aucun prescripteur enregistré"
      description="Ajoutez les médecins et établissements qui prescrivent des transports pour vos patients."
      action={{
        onClick: onCreate,
        label: 'Ajouter un prescripteur',
        icon: Plus,
        variant: 'accent',
      }}
    />
  );
}
