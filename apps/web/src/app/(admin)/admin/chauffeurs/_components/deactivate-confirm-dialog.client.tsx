'use client';

/**
 * Modal de confirmation simple — désactivation chauffeur (DEC-029).
 *
 * Sémantique : action réversible facilement (réactivation instantanée),
 * un simple coche de confirmation suffit. Régulateur ET dirigeant.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import {
  deactivateDriverInputSchema,
  type DeactivateDriverInput,
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
import { deactivateDriverAction } from '../actions';

interface Props {
  driver: { id: string; nom_affichage: string } | null;
  onClose: () => void;
  onDeactivated: () => void;
}

export function DeactivateConfirmDialog({
  driver,
  onClose,
  onDeactivated,
}: Props): JSX.Element | null {
  const router = useRouter();
  const form = useForm<DeactivateDriverInput>({
    resolver: zodResolver(deactivateDriverInputSchema),
    mode: 'onChange',
    defaultValues: {
      confirmation: false as unknown as DeactivateDriverInput['confirmation'],
    },
  });

  React.useEffect(() => {
    if (driver) {
      form.reset({
        confirmation: false as unknown as DeactivateDriverInput['confirmation'],
      });
    }
  }, [driver, form]);

  if (!driver) return null;

  const onSubmit = form.handleSubmit(async () => {
    const fd = new FormData();
    fd.set('confirmation', 'true');
    const res = await deactivateDriverAction(driver.id, {}, fd);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Chauffeur désactivé.');
    onDeactivated();
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
          <DialogTitle>Désactiver « {driver.nom_affichage} » ?</DialogTitle>
          <DialogDescription>
            Ce chauffeur ne pourra plus être affecté à des courses. L&apos;action
            est réversible : vous pourrez le réactiver à tout moment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-16" noValidate>
          <div className="flex items-start gap-12">
            <input
              id="deactivate-confirm"
              type="checkbox"
              className="mt-4 h-16 w-16 rounded border-border accent-primary"
              checked={checked}
              onChange={(e) =>
                form.setValue(
                  'confirmation',
                  e.target
                    .checked as unknown as DeactivateDriverInput['confirmation'],
                  { shouldValidate: true },
                )
              }
            />
            <Label htmlFor="deactivate-confirm" className="text-sm">
              Je confirme la désactivation.
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
              {isSubmitting ? 'Désactivation…' : 'Désactiver'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
