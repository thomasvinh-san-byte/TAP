'use client';

/**
 * Modal de confirmation renforcée pour archivage chauffeur
 * (Phase 04 hotfix DEC-029 — UX option C).
 *
 * Pourquoi ce composant existe :
 *   L'archivage est élargi au régulateur (en plus du dirigeant) mais reste
 *   une opération irréversible côté UX. Pour limiter les erreurs et garantir
 *   la trace RGPD, on exige :
 *     1. Un motif libre (10..500 caractères) journalisé en BDD
 *        (`drivers.archive_motif`) et `audit_logs` (action `driver_archived`)
 *     2. Une saisie explicite du mot « ARCHIVER » pour confirmer
 *
 * Pattern RHF + zodResolver (DEC-018/028) sans wrapper `<Form>` shadcn.
 */

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

import { archiveDriverInputSchema, type ArchiveDriverInput } from '@tap/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { archiveDriverAction } from '../actions';

interface Props {
  driver: { id: string; nom_affichage: string } | null;
  onClose: () => void;
  onArchived: () => void;
}

export function ArchiveDriverModal({ driver, onClose, onArchived }: Props): JSX.Element | null {
  const router = useRouter();
  const form = useForm<ArchiveDriverInput>({
    resolver: zodResolver(archiveDriverInputSchema),
    mode: 'onBlur',
    defaultValues: { motif: '', confirmation: '' as ArchiveDriverInput['confirmation'] },
  });

  // Reset form à chaque ouverture (driver change ou re-open)
  React.useEffect(() => {
    if (driver) form.reset({ motif: '', confirmation: '' as ArchiveDriverInput['confirmation'] });
  }, [driver, form]);

  if (!driver) return null;

  const onSubmit = form.handleSubmit(async (data) => {
    const fd = new FormData();
    fd.set('motif', data.motif);
    fd.set('confirmation', data.confirmation);
    const res = await archiveDriverAction(driver.id, {}, fd);
    if (res.error) {
      toast.error(res.error);
      if (res.fieldErrors) {
        Object.entries(res.fieldErrors).forEach(([field, message]) => {
          form.setError(field as keyof ArchiveDriverInput, { message });
        });
      }
      return;
    }
    toast.success('Chauffeur archivé.');
    onArchived();
    router.refresh();
    onClose();
  });

  const isSubmitting = form.formState.isSubmitting;
  const motifError = form.formState.errors.motif?.message;
  const confirmationError = form.formState.errors.confirmation?.message;

  return (
    <Dialog
      open={driver !== null}
      onOpenChange={(o) => {
        if (!o && !isSubmitting) onClose();
      }}
    >
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Archiver « {driver.nom_affichage} » ?</DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Le chauffeur ne pourra plus accéder à l&apos;application
            et ne pourra plus être affecté à des courses. Les courses passées restent intactes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-16" noValidate>
          <div className="space-y-8">
            <Label htmlFor="archive-motif">Motif d&apos;archivage</Label>
            <Textarea
              id="archive-motif"
              rows={3}
              maxLength={500}
              placeholder="Ex. : départ de la société, fin de contrat, retraite anticipée…"
              aria-invalid={!!motifError}
              {...form.register('motif')}
            />
            <p className="text-muted-foreground text-xs">
              10 caractères minimum. Sera tracé dans l&apos;historique.
            </p>
            {motifError ? (
              <p role="alert" className="text-destructive text-sm">
                {motifError}
              </p>
            ) : null}
          </div>

          <div className="space-y-8">
            <Label htmlFor="archive-confirmation">Confirmer en saisissant « ARCHIVER »</Label>
            <Input
              id="archive-confirmation"
              type="text"
              autoComplete="off"
              className="h-10"
              aria-invalid={!!confirmationError}
              {...form.register('confirmation')}
            />
            {confirmationError ? (
              <p role="alert" className="text-destructive text-sm">
                {confirmationError}
              </p>
            ) : null}
          </div>

          <DialogFooter className="gap-12">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Conserver
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!form.formState.isValid || isSubmitting}
              aria-busy={isSubmitting}
              className="h-10"
            >
              {isSubmitting ? 'Archivage…' : 'Archiver définitivement'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
