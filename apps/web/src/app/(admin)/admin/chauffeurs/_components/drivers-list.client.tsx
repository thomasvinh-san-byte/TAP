'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  DRIVER_FORM_STATUS_VALUES,
  DRIVER_STATUS_LABELS,
  type DriverFormStatus,
} from '@tap/shared';
import { Button } from '@/components/ui/button';
import { SegmentedNav } from '@/components/ui/segmented-control';
import { Select } from '@/components/ui/select';
import { DataTable, ListToolbar, ListMeta, Pagination } from '@/components/data-table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { reactivateDriverAction } from '../actions';
import type { DriverRow } from '../page';
import { DriverForm } from './driver-form.client';
import { ArchiveDriverModal } from './archive-driver-modal.client';
import { DeactivateConfirmDialog } from './deactivate-confirm-dialog.client';
import { UnarchiveConfirmDialog } from './unarchive-confirm-dialog.client';
import { buildDriverColumns } from './drivers-columns';
import { DriversEmptyState } from './drivers-empty-state.client';
import {
  DriverInvitationDialogs,
  type InvitationDialogState,
} from './driver-invitation-dialogs.client';

type Role = 'dirigeant' | 'regulateur';
type Vue = 'actifs' | 'archives';

interface Props {
  initialDrivers: DriverRow[];
  currentRole: Role;
  vue: Vue;
  /** Map driver_id → prochaine date d'échéance (Phase 06.33). */
  nextComplianceByDriverId?: Record<string, string>;
  /** Échafaudage upload documents conformité (DEC-143, évalué serveur). */
  uploadEnabled?: boolean;
}

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; driver: DriverRow };

const PAGE_SIZE = 50;

export function DriversList({
  initialDrivers,
  currentRole,
  vue,
  nextComplianceByDriverId,
  uploadEnabled = false,
}: Props): JSX.Element {
  const router = useRouter();
  const isDirigeant = currentRole === 'dirigeant';

  const [mode, setMode] = React.useState<Mode>({ kind: 'closed' });
  const [archiveTarget, setArchiveTarget] = React.useState<DriverRow | null>(null);
  const [deactivateTarget, setDeactivateTarget] = React.useState<DriverRow | null>(null);
  const [unarchiveTarget, setUnarchiveTarget] = React.useState<DriverRow | null>(null);
  const [invitationDialog, setInvitationDialog] = React.useState<InvitationDialogState>({
    kind: 'closed',
  });
  const [reactivatingId, setReactivatingId] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<'tous' | DriverFormStatus>('tous');
  const [page, setPage] = React.useState(0);

  const close = React.useCallback(() => setMode({ kind: 'closed' }), []);

  const onSuccess = React.useCallback(() => {
    close();
    router.refresh();
  }, [close, router]);

  const onArchived = React.useCallback(() => {
    setArchiveTarget(null);
    close();
  }, [close]);

  const onReactivate = React.useCallback(
    async (driver: DriverRow) => {
      setReactivatingId(driver.id);
      try {
        const res = await reactivateDriverAction(driver.id);
        if (res.error) {
          toast.error(res.error);
          return;
        }
        toast.success('Chauffeur réactivé.');
        router.refresh();
      } finally {
        setReactivatingId(null);
      }
    },
    [router],
  );

  const columns = buildDriverColumns({
    currentRole,
    reactivatingId,
    nextComplianceByDriverId,
    handlers: {
      onInvite: (driver) => setInvitationDialog({ kind: 'invite', driver }),
      onResend: (driver) => setInvitationDialog({ kind: 'resend', driver }),
      onDeactivate: (driver) => setDeactivateTarget(driver),
      onReactivate,
      onArchive: (driver) => setArchiveTarget(driver),
      onUnarchive: (driver) => setUnarchiveTarget(driver),
    },
  });

  // Filtre par statut (vue actifs uniquement : elle contient actif/conge/suspendu).
  const filtered = React.useMemo(
    () =>
      vue === 'actifs' && statusFilter !== 'tous'
        ? initialDrivers.filter((d) => d.status === statusFilter)
        : initialDrivers,
    [initialDrivers, vue, statusFilter],
  );
  const paged = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  return (
    <div className="space-y-16">
      <ListToolbar
        filters={
          <div className="flex flex-wrap items-center gap-12">
            <ViewToggle currentVue={vue} />
            {vue === 'actifs' && (
              <Select
                ariaLabel="Filtrer par statut"
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v as 'tous' | DriverFormStatus);
                  setPage(0);
                }}
                items={[
                  { value: 'tous', label: 'Tous les statuts' },
                  ...DRIVER_FORM_STATUS_VALUES.map((s) => ({
                    value: s,
                    label: DRIVER_STATUS_LABELS[s],
                  })),
                ]}
                triggerClassName="w-[180px]"
              />
            )}
          </div>
        }
        actions={
          vue === 'actifs' ? (
            <Button
              type="button"
              variant="accent"
              onClick={() => setMode({ kind: 'create' })}
              className="gap-8"
            >
              <Plus className="h-16 w-16" aria-hidden />
              Nouveau chauffeur
            </Button>
          ) : null
        }
      />

      <ListMeta>
        {filtered.length} chauffeur
        {filtered.length > 1 ? 's' : ''}
        {vue === 'archives' ? ' archivé' : ''}
        {vue === 'archives' && filtered.length > 1 ? 's' : ''}
      </ListMeta>

      <DataTable<DriverRow>
        columns={columns}
        rows={paged}
        // DEC-033 : clé inclut `actif`/`archive` pour re-mount au changement
        // d'état (Désactiver / Réactiver / Archiver / Désarchiver). Sans ça,
        // les boutons d'action restent figés sur l'ancien état après
        // router.refresh().
        rowKey={(d) => `${d.id}-${d.status}`}
        ariaLabel={`Liste des chauffeurs ${vue === 'archives' ? 'archivés' : 'actifs'}`}
        onRowClick={(d) => setMode({ kind: 'edit', driver: d })}
        emptyState={<DriversEmptyState vue={vue} onCreate={() => setMode({ kind: 'create' })} />}
      />

      <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />

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
              {mode.kind === 'edit' ? 'Modifier le chauffeur' : 'Nouveau chauffeur'}
            </SheetTitle>
            <SheetDescription>
              Les informations sont visibles dans la fenêtre d&apos;affectation de course.
            </SheetDescription>
          </SheetHeader>

          {mode.kind === 'create' && (
            <DriverForm onSuccess={onSuccess} onCancel={close} uploadEnabled={uploadEnabled} />
          )}
          {mode.kind === 'edit' && (
            <DriverForm
              initial={mode.driver}
              onSuccess={onSuccess}
              onCancel={close}
              uploadEnabled={uploadEnabled}
              onArchive={
                isDirigeant && !mode.driver.archive
                  ? () => setArchiveTarget(mode.driver)
                  : undefined
              }
            />
          )}
        </SheetContent>
      </Sheet>

      <ArchiveDriverModal
        driver={
          archiveTarget
            ? { id: archiveTarget.id, nom_affichage: archiveTarget.nom_affichage }
            : null
        }
        onClose={() => setArchiveTarget(null)}
        onArchived={onArchived}
      />

      <DeactivateConfirmDialog
        driver={
          deactivateTarget
            ? { id: deactivateTarget.id, nom_affichage: deactivateTarget.nom_affichage }
            : null
        }
        onClose={() => setDeactivateTarget(null)}
        onDeactivated={() => setDeactivateTarget(null)}
      />

      <UnarchiveConfirmDialog
        driver={
          unarchiveTarget
            ? { id: unarchiveTarget.id, nom_affichage: unarchiveTarget.nom_affichage }
            : null
        }
        onClose={() => setUnarchiveTarget(null)}
        onUnarchived={() => setUnarchiveTarget(null)}
      />

      <DriverInvitationDialogs
        state={invitationDialog}
        onClose={() => setInvitationDialog({ kind: 'closed' })}
      />
    </div>
  );
}

function ViewToggle({ currentVue }: { currentVue: Vue }) {
  return (
    <SegmentedNav<Vue>
      ariaLabel="Filtre chauffeurs"
      value={currentVue}
      options={[
        { value: 'actifs', label: 'Actifs', href: '/admin/chauffeurs?vue=actifs' },
        { value: 'archives', label: 'Archivés', href: '/admin/chauffeurs?vue=archives' },
      ]}
    />
  );
}
