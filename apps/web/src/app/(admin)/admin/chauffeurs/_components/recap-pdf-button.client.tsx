'use client';

import { useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateFieldFr } from '@/components/date-field-fr.client';
import { Label } from '@/components/ui/label';

/**
 * Bouton « Récap PDF » d'un chauffeur (Phase 06.37 §5.23, DEC-116).
 *
 * Ouvre un mini-dialog pour saisir la période (from/to) puis redirige
 * vers la route `app/api/admin/chauffeurs/recap/pdf` qui renvoie un PDF
 * inline (Content-Disposition attachment). Pas de logique de calcul
 * côté client.
 *
 * Visible uniquement pour le dirigeant (le bouton n'est pas rendu pour
 * le régulateur — pattern row-actions de drivers-list).
 */

interface Props {
  driverId: string;
  driverLabel: string;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export function RecapPdfButton({ driverId, driverLabel }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(isoDaysAgo(30));
  const [to, setTo] = useState(todayIso());

  function onConfirm() {
    const url = `/api/admin/chauffeurs/recap/pdf?driver=${encodeURIComponent(driverId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    window.open(url, '_blank');
    setOpen(false);
  }

  const invalid = !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from > to;

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="gap-8"
        aria-label={`Récap PDF de ${driverLabel}`}
      >
        <FileText className="h-12 w-12" aria-hidden />
        Récap PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Récap PDF — {driverLabel}</DialogTitle>
            <DialogDescription>
              Génère un PDF des courses du chauffeur sur la période choisie. Document interne, ne se
              substitue à aucun document légal de facturation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-12 py-12">
            <div className="space-y-4">
              <Label htmlFor={`recap-from-${driverId}`}>Du</Label>
              <DateFieldFr id={`recap-from-${driverId}`} value={from} onChange={setFrom} />
            </div>
            <div className="space-y-4">
              <Label htmlFor={`recap-to-${driverId}`}>Au</Label>
              <DateFieldFr id={`recap-to-${driverId}`} value={to} onChange={setTo} />
            </div>
          </div>

          {invalid && (
            <p className="text-destructive text-sm" role="alert">
              Période invalide : la date de fin doit être postérieure ou égale à la date de début.
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="button" onClick={onConfirm} disabled={invalid}>
              Télécharger le PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
