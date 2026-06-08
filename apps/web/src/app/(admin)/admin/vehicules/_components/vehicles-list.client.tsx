'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Accessibility, Car, HeartPulse, Plus, PlusCircle, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ComplianceBadge } from '@/components/ui/compliance-badge';
import { EmptyState as SharedEmptyState } from '@/components/ui/empty-state';
import { DataTable, type DataTableColumn } from '@/components/data-table';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { archiveVehicleAction } from '../actions';
import type { VehicleRow } from '../page';
import { VehicleForm } from './vehicle-form.client';

interface Props {
  initialVehicles: VehicleRow[];
  /** Map vehicle_id → prochaine date d'échéance (Phase 06.33). */
  nextComplianceByVehicleId?: Record<string, string>;
}

type Mode = { kind: 'closed' } | { kind: 'create' } | { kind: 'edit'; vehicle: VehicleRow };

const TYPE_LABELS: Record<VehicleRow['type'], string> = {
  taxi_conventionne: 'Taxi conventionné',
  tpmr: 'TPMR',
  vsl: 'VSL',
  ambulance: 'Ambulance',
};

const TYPE_ICONS: Record<VehicleRow['type'], LucideIcon> = {
  taxi_conventionne: Car,
  tpmr: Accessibility,
  vsl: HeartPulse,
  ambulance: PlusCircle,
};

export function VehiclesList({ initialVehicles, nextComplianceByVehicleId }: Props): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>({ kind: 'closed' });
  const [archiveTarget, setArchiveTarget] = React.useState<VehicleRow | null>(null);

  const close = React.useCallback(() => setMode({ kind: 'closed' }), []);

  const onSuccess = React.useCallback(() => {
    close();
    router.refresh();
  }, [close, router]);

  const onArchive = async () => {
    if (!archiveTarget) return;
    const res = await archiveVehicleAction(archiveTarget.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Véhicule archivé.');
    setArchiveTarget(null);
    close();
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {initialVehicles.length} véhicule
          {initialVehicles.length > 1 ? 's' : ''}
        </p>
        <Button
          type="button"
          variant="accent"
          onClick={() => setMode({ kind: 'create' })}
          className="gap-8"
        >
          <Plus className="h-16 w-16" aria-hidden />
          Nouveau véhicule
        </Button>
      </div>

      <DataTable<VehicleRow>
        columns={[
          {
            key: 'vehicule',
            header: 'Véhicule',
            cell: (v) => {
              const Icon = TYPE_ICONS[v.type];
              return (
                <div className="flex items-center gap-12">
                  <div className="bg-muted text-muted-foreground flex h-32 w-32 shrink-0 items-center justify-center rounded-md">
                    <Icon className="h-16 w-16" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium uppercase tabular-nums">{v.immatriculation}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {[v.marque, v.modele].filter(Boolean).join(' ') ||
                        'Marque/modèle non renseigné'}
                    </div>
                  </div>
                </div>
              );
            },
          },
          {
            key: 'type',
            header: 'Type',
            width: '180px',
            cell: (v) => (
              <Badge variant="secondary" className="text-xs">
                {TYPE_LABELS[v.type]}
              </Badge>
            ),
          },
          {
            key: 'places',
            header: 'Places',
            width: '100px',
            cell: (v) =>
              v.places_assises !== null ? (
                <Badge variant="outline" className="text-xs tabular-nums">
                  {v.places_assises} pl.
                </Badge>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              ),
          },
          {
            key: 'actif',
            header: 'Statut',
            width: '120px',
            cell: (v) =>
              v.actif ? <Badge>Actif</Badge> : <Badge variant="outline">Inactif</Badge>,
          },
          {
            key: 'conformite',
            header: 'Conformité',
            width: '160px',
            cell: (v) => {
              const next = nextComplianceByVehicleId?.[v.id];
              return next ? (
                <ComplianceBadge expiresAt={next} />
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              );
            },
          },
        ]}
        rows={initialVehicles}
        // DEC-033 : clé inclut `actif` pour re-mount au changement.
        rowKey={(v) => `${v.id}-${v.actif}`}
        ariaLabel="Liste des véhicules de la flotte"
        onRowClick={(v) => setMode({ kind: 'edit', vehicle: v })}
        emptyState={<EmptyState onCreate={() => setMode({ kind: 'create' })} />}
      />

      <Sheet
        open={mode.kind !== 'closed'}
        onOpenChange={(o) => {
          if (!o) close();
        }}
      >
        <SheetContent
          side="right"
          className="w-[480px] overflow-y-auto sm:w-[480px] sm:max-w-[480px]"
        >
          <SheetHeader>
            <SheetTitle>
              {mode.kind === 'edit' ? 'Modifier le véhicule' : 'Nouveau véhicule'}
            </SheetTitle>
            <SheetDescription>
              Visible dans la fenêtre d&apos;affectation de course.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-24">
            {mode.kind === 'create' && <VehicleForm onSuccess={onSuccess} />}
            {mode.kind === 'edit' && <VehicleForm initial={mode.vehicle} onSuccess={onSuccess} />}
          </div>

          {mode.kind === 'edit' && (
            <div className="border-border mt-24 border-t pt-16">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
                onClick={() => setArchiveTarget(mode.vehicle)}
              >
                Archiver ce véhicule
              </Button>
            </div>
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
            <SheetTitle>Archiver « {archiveTarget?.immatriculation} » ?</SheetTitle>
            <SheetDescription>
              Le véhicule n&apos;apparaîtra plus dans la fenêtre d&apos;affectation. Les courses
              passées restent intactes.
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
      icon={Car}
      title="Aucun véhicule enregistré"
      description="Ajoutez votre flotte pour pouvoir assigner les courses."
      action={{ onClick: onCreate, label: 'Ajouter un véhicule', icon: Plus, variant: 'accent' }}
    />
  );
}
