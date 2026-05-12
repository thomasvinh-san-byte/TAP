'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, UserCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { archiveDriverAction } from '../actions';
import type { DriverRow } from '../page';
import { DriverForm } from './driver-form.client';

interface Props {
  initialDrivers: DriverRow[];
}

type Mode =
  | { kind: 'closed' }
  | { kind: 'create' }
  | { kind: 'edit'; driver: DriverRow };

export function DriversList({ initialDrivers }: Props): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>({ kind: 'closed' });
  const [archiveTarget, setArchiveTarget] = React.useState<DriverRow | null>(
    null,
  );

  const close = React.useCallback(() => setMode({ kind: 'closed' }), []);

  const onSuccess = React.useCallback(() => {
    close();
    router.refresh();
  }, [close, router]);

  const onArchive = async () => {
    if (!archiveTarget) return;
    const res = await archiveDriverAction(archiveTarget.id);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Chauffeur archivé.');
    setArchiveTarget(null);
    close();
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {initialDrivers.length} chauffeur
          {initialDrivers.length > 1 ? 's' : ''}
        </p>
        <Button
          type="button"
          onClick={() => setMode({ kind: 'create' })}
          className="gap-8"
        >
          <Plus className="h-16 w-16" aria-hidden />
          Nouveau chauffeur
        </Button>
      </div>

      {initialDrivers.length === 0 ? (
        <EmptyState onCreate={() => setMode({ kind: 'create' })} />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {initialDrivers.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => setMode({ kind: 'edit', driver: d })}
                className="flex w-full items-center gap-12 px-16 py-12 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              >
                <InitialsAvatar
                  name={d.nom_affichage}
                  role="chauffeur"
                  size={32}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {d.nom_affichage}
                  </div>
                  <div className="flex items-center gap-8 text-xs text-muted-foreground tabular-nums">
                    {d.telephone ?? 'Téléphone non renseigné'}
                    {d.numero_licence && <span>· Lic. {d.numero_licence}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-8 shrink-0">
                  {d.type_permis.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">
                      {t.toUpperCase()}
                    </Badge>
                  ))}
                  {d.profile_id ? (
                    <Badge variant="secondary">Compte lié</Badge>
                  ) : (
                    <Badge variant="outline">Sans compte</Badge>
                  )}
                  {d.actif ? (
                    <Badge>Actif</Badge>
                  ) : (
                    <Badge variant="outline">Inactif</Badge>
                  )}
                </div>
              </button>
            </li>
          ))}
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
          className="w-[480px] sm:w-[480px] sm:max-w-[480px] overflow-y-auto"
        >
          <SheetHeader>
            <SheetTitle>
              {mode.kind === 'edit'
                ? 'Modifier le chauffeur'
                : 'Nouveau chauffeur'}
            </SheetTitle>
            <SheetDescription>
              Les informations sont visibles dans la modal d&apos;assignation
              de course.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-24">
            {mode.kind === 'create' && (
              <DriverForm onSuccess={onSuccess} />
            )}
            {mode.kind === 'edit' && (
              <DriverForm initial={mode.driver} onSuccess={onSuccess} />
            )}
          </div>

          {mode.kind === 'edit' && (
            <div className="mt-24 border-t border-border pt-16">
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive w-full"
                onClick={() => setArchiveTarget(mode.driver)}
              >
                Archiver ce chauffeur
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
            <SheetTitle>Archiver « {archiveTarget?.nom_affichage} » ?</SheetTitle>
            <SheetDescription>
              Le chauffeur n&apos;apparaîtra plus dans la modal
              d&apos;assignation. Les courses passées restent intactes.
            </SheetDescription>
          </SheetHeader>
          <div className="flex justify-end gap-12">
            <Button
              type="button"
              variant="outline"
              onClick={() => setArchiveTarget(null)}
            >
              Conserver
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void onArchive()}
            >
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
    <div className="flex flex-col items-center gap-12 rounded-md border border-dashed border-border py-48 text-center">
      <UserCircle2
        className="h-48 w-48 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden
      />
      <div>
        <h2 className="text-base font-semibold">Aucun chauffeur</h2>
        <p className="text-sm text-muted-foreground">
          Ajoutez un premier chauffeur pour pouvoir assigner des courses.
        </p>
      </div>
      <Button type="button" onClick={onCreate} className="gap-8">
        <Plus className="h-16 w-16" aria-hidden />
        Nouveau chauffeur
      </Button>
    </div>
  );
}
