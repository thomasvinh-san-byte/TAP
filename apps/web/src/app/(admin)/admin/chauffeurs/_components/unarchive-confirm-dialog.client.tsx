'use client';

/**
 * Modal de confirmation simple — désarchivage chauffeur (DEC-029).
 *
 * Sémantique : action de réintégration ; le chauffeur revient dans le
 * système en restant désactivé. Régulateur ET dirigeant autorisés
 * (le trigger Postgres `drivers_archive_columns_guard` autorise la
 * transition archive true → false pour les deux rôles).
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  unarchiveDriverInputSchema,
  type UnarchiveDriverInput,
} from '@tap/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { unarchiveDriverAction } from '../actions';

interface Props {
  driver: { id: string; nom_affichage: string } | null;
  onClose: () => void;
  onUnarchived: () => void;
}

export function UnarchiveConfirmDialog({
  driver,
  onClose,
  onUnarchived,
}: Props): JSX.Element | null {
  const router = useRouter();
  const form = useForm<UnarchiveDriverInput>({
    resolver: zodResolver(unarchiveDriverInputSchema),
    mode: 'onChange',
    defaultValues: {
      confirmation: false as unknown as UnarchiveDriverInput['confirmation'],
    },
  });

  React.useEffect(() => {
    if (driver) {
      form.reset({
        confirmation: false as unknown as UnarchiveDriverInput['confirmation'],
      });
    }
  }, [driver, form]);

  if (!driver) return null;

  const onSubmit = form.handleSubmit(async () => {
    const fd = new FormData();
    fd.set('confirmation', 'true');
    const res = await unarchiveDriverAction(driver.id, {}, fd);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Chauffeur désarchivé.');
    onUnarchived();
    router.refresh();
    onClose();
  });

  const isSubmitting = form.formState.isSubmitting;
  const checked = form.watch('confirmation') === true;

  return (
    <Dialog
      open={driver !== null}
      onOpenChange={(o) => {
        if (!o && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Désarchiver « {driver.nom_affichage} » ?</DialogTitle>
          <DialogDescription>
            Le chauffeur sera réintégré au système, désactivé par défaut.
            Vous pourrez le réactiver ensuite.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-16" noValidate>
          <div className="flex items-start gap-12">
            <input
              id="unarchive-confirm"
              type="checkbox"
              className="mt-4 h-16 w-16 rounded border-border accent-primary"
              checked={checked}
              onChange={(e) =>
                form.setValue(
                  'confirmation',
                  e.target
                    .checked as unknown as UnarchiveDriverInput['confirmation'],
                  { shouldValidate: true },
                )
              }
            />
            <Label htmlFor="unarchive-confirm" className="text-sm">
              Je confirme le désarchivage.
            </Label>
          </div>

          <DialogFooter className="gap-12">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!checked || isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? 'Désarchivage…' : 'Désarchiver'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
