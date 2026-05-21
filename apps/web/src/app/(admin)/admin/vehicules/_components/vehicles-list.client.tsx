'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Accessibility, Car, HeartPulse, Plus, PlusCircle, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export function VehiclesList({ initialVehicles }: Props): JSX.Element {
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
        <Button type="button" onClick={() => setMode({ kind: 'create' })} className="gap-8">
          <Plus className="h-16 w-16" aria-hidden />
          Nouveau véhicule
        </Button>
      </div>

      {initialVehicles.length === 0 ? (
        <EmptyState onCreate={() => setMode({ kind: 'create' })} />
      ) : (
        <ul className="divide-border border-border divide-y rounded-md border">
          {initialVehicles.map((v) => {
            const Icon = TYPE_ICONS[v.type];
            return (
              // Clé inclut `actif` pour forcer le re-mount au changement
              // de l'état actif (toggle via formulaire). Pas `archive` ici :
              // page.tsx ne fetch que les véhicules non-archivés (DEC-033).
              <li key={`${v.id}-${v.actif}`}>
                <button
                  type="button"
                  onClick={() => setMode({ kind: 'edit', vehicle: v })}
                  className="hover:bg-muted focus-visible:ring-ring flex w-full items-center gap-12 px-16 py-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
                >
                  <div className="bg-muted text-muted-foreground flex h-32 w-32 items-center justify-center rounded-md">
                    <Icon className="h-16 w-16" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium uppercase tabular-nums">{v.immatriculation}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {[v.marque, v.modele].filter(Boolean).join(' ') ||
                        'Marque/modèle non renseigné'}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-8">
                    <Badge variant="secondary" className="text-xs">
                      {TYPE_LABELS[v.type]}
                    </Badge>
                    {v.places_assises !== null && (
                      <Badge variant="outline" className="text-xs tabular-nums">
                        {v.places_assises} pl.
                      </Badge>
                    )}
                    {v.actif ? <Badge>Actif</Badge> : <Badge variant="outline">Inactif</Badge>}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

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
    <div className="border-border flex flex-col items-center gap-12 rounded-md border border-dashed py-48 text-center">
      <Car className="text-muted-foreground h-48 w-48" strokeWidth={1.5} aria-hidden />
      <div>
        <h2 className="text-base font-semibold">Aucun véhicule</h2>
        <p className="text-muted-foreground text-sm">
          Ajoutez un premier véhicule pour pouvoir affecter des courses.
        </p>
      </div>
      <Button type="button" onClick={onCreate} className="gap-8">
        <Plus className="h-16 w-16" aria-hidden />
        Nouveau véhicule
      </Button>
    </div>
  );
}
