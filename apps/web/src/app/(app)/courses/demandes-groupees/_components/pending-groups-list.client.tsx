'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { acceptRideGroupAction, refuseRideGroupAction } from '../../actions';
import type { PendingGroupRow } from '../page';

/**
 * File des demandes groupées en attente (DEC-158, CdC §5.5 l.193) : la
 * régulation accepte (courses → fermes) ou refuse (motif obligatoire).
 */
export function PendingGroupsList({ pending }: { pending: PendingGroupRow[] }): JSX.Element {
  const router = useRouter();
  const [refuseTarget, setRefuseTarget] = React.useState<PendingGroupRow | null>(null);
  const [motif, setMotif] = React.useState('');
  const [pendingAction, startTransition] = React.useTransition();

  function onAccept(group: PendingGroupRow): void {
    startTransition(async () => {
      const res = await acceptRideGroupAction(group.id);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Demande acceptée — ${group.ride_count} course(s) confirmée(s).`);
      router.refresh();
    });
  }

  function onConfirmRefuse(): void {
    if (!refuseTarget) return;
    const target = refuseTarget;
    startTransition(async () => {
      const res = await refuseRideGroupAction(target.id, { motif });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      toast.success('Demande refusée.');
      setRefuseTarget(null);
      setMotif('');
      router.refresh();
    });
  }

  if (pending.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="Aucune demande groupée en attente"
        description="Les demandes groupées soumises par les donneurs d'ordres apparaîtront ici pour acceptation ou refus."
      />
    );
  }

  return (
    <>
      <ul className="divide-border border-border divide-y rounded-md border">
        {pending.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-12 p-16">
            <div className="flex min-w-0 items-center gap-12">
              <div className="bg-muted text-muted-foreground flex h-32 w-32 shrink-0 items-center justify-center rounded-md">
                <Layers className="h-16 w-16" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{g.ordering_party_label}</div>
                <div className="text-muted-foreground text-xs tabular-nums">
                  {g.ride_count} course{g.ride_count > 1 ? 's' : ''} ·{' '}
                  {new Date(g.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-8">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setRefuseTarget(g)}
                disabled={pendingAction}
                className="gap-8"
              >
                <X className="h-12 w-12" aria-hidden />
                Refuser
              </Button>
              <Button
                type="button"
                variant="accent"
                size="sm"
                onClick={() => onAccept(g)}
                disabled={pendingAction}
                className="gap-8"
              >
                <Check className="h-12 w-12" aria-hidden />
                Accepter
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Sheet
        open={refuseTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRefuseTarget(null);
            setMotif('');
          }
        }}
      >
        <SheetContent side="bottom" className="space-y-16 p-24">
          <SheetHeader>
            <SheetTitle>
              Refuser la demande de « {refuseTarget?.ordering_party_label} » ?
            </SheetTitle>
            <SheetDescription>
              Les {refuseTarget?.ride_count} course(s) seront annulées. Indiquez le motif (tracé).
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-8">
            <Label htmlFor="motif-refus">Motif du refus</Label>
            <textarea
              id="motif-refus"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              maxLength={500}
              rows={3}
              className="border-input focus-visible:ring-ring w-full rounded-md border px-12 py-8 text-sm focus-visible:outline-none focus-visible:ring-2"
              placeholder="Ex. créneaux indisponibles, doublon avec une autre demande…"
            />
          </div>
          <div className="flex justify-end gap-12">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRefuseTarget(null);
                setMotif('');
              }}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={onConfirmRefuse}
              disabled={pendingAction || motif.trim().length === 0}
            >
              Refuser la demande
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
