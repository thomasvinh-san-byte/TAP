'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { validatePlanningAction } from '../actions/validation';
import type { PlanningValidationStatus } from '../_lib/validation-queries';

interface Props {
  date: string;
  validation: PlanningValidationStatus | null;
}

function formatDateTimeFr(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Indian/Reunion',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Barre de validation du planning (Module 5.12 lot D). Si le jour n'est pas
 * validé : bouton « Valider le planning » (confirmation, car l'action notifie
 * chauffeurs et patients). Si validé : rappel de l'horodatage + compteurs de
 * notification + accès à l'historique prévu vs réalisé (lot E). Composant séparé
 * pour ne pas alourdir la grille.
 */
export function PlanningValidateBar({ date, validation }: Props): JSX.Element {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const historiqueHref = `/planning/historique?date=${date}`;

  function confirmValidate(): void {
    startTransition(async () => {
      const res = await validatePlanningAction({ planningDate: date });
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setConfirmOpen(false);
      toast.success(
        res.alreadyValidated
          ? 'Planning déjà validé.'
          : `Planning validé. ${res.snapshot ?? 0} course${(res.snapshot ?? 0) > 1 ? 's' : ''} figée${
              (res.snapshot ?? 0) > 1 ? 's' : ''
            }.`,
      );
      router.refresh();
    });
  }

  if (validation) {
    return (
      <div className="border-success/30 bg-success/5 flex flex-wrap items-center justify-between gap-8 rounded-lg border px-16 py-12">
        <div className="text-success-foreground flex items-center gap-8 text-sm">
          <CheckCircle2 className="text-success h-16 w-16 shrink-0" aria-hidden />
          <span>
            {/* « Envoyé à N chauffeurs » (push adressé, best-effort — on ne
                garantit pas la réception) vs « M patients notifiés par SMS »
                (envois réels comptés). Cohérent avec la doctrine : pas de fausse
                certitude de réception côté chauffeur. */}
            Planning validé le {formatDateTimeFr(validation.validatedAt)} · envoyé à{' '}
            <span className="tabular-nums">{validation.notifiedDrivers}</span> chauffeur
            {validation.notifiedDrivers > 1 ? 's' : ''} ·{' '}
            <span className="tabular-nums">{validation.notifiedPatients}</span> patient
            {validation.notifiedPatients > 1 ? 's' : ''} notifié
            {validation.notifiedPatients > 1 ? 's' : ''} par SMS.
          </span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={historiqueHref}>
            <History className="mr-8 h-12 w-12" aria-hidden />
            Historique prévu / réalisé
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="border-border flex flex-wrap items-center justify-between gap-8 rounded-lg border px-16 py-12">
        <p className="text-muted-foreground text-sm">
          Planning non validé. La validation notifie les chauffeurs et confirme aux patients, puis
          fige le prévu du jour.
        </p>
        <div className="flex items-center gap-8">
          <Button asChild variant="ghost" size="sm">
            <Link href={historiqueHref}>
              <History className="mr-8 h-12 w-12" aria-hidden />
              Historique
            </Link>
          </Button>
          <Button type="button" variant="accent" onClick={() => setConfirmOpen(true)}>
            <CheckCircle2 className="mr-8 h-16 w-16" aria-hidden />
            Valider le planning
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={(o) => !o && setConfirmOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Valider le planning ?</DialogTitle>
            <DialogDescription>
              Les chauffeurs concernés recevront une notification et les patients ayant consenti un
              SMS de confirmation. Le prévu du jour sera figé pour le suivi. Action best-effort et
              idempotente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="button" onClick={confirmValidate} disabled={pending}>
              Confirmer la validation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
