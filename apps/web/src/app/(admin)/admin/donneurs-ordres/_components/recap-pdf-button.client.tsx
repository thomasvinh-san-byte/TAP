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
import type { OrderingPartyRow } from '../page';

/**
 * Bouton « Récap PDF » d'un donneur d'ordres (CdC §5.5 l.195, DEC-159).
 *
 * Ouvre un mini-dialog pour saisir la période (from/to) — pré-remplie selon la
 * modalité de facturation du donneur (hebdomadaire → semaine en cours ;
 * mensuelle / à la course → mois en cours) — puis redirige vers la route
 * `api/admin/donneurs-ordres/recap/pdf` qui renvoie un PDF (Content-Disposition
 * attachment). Pas de calcul côté client : le total reflète `tarif_amount_eur`
 * réellement stocké (grille B2B 07.02 si grille_propre).
 */

interface Props {
  party: Pick<OrderingPartyRow, 'id' | 'raison_sociale' | 'modalite_facturation'>;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

/** Lundi de la semaine en cours (ISO, UTC) au format AAAA-MM-JJ. */
function mondayOfWeekIso(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0 = dimanche
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

function defaultFrom(modalite: OrderingPartyRow['modalite_facturation']): string {
  return modalite === 'hebdomadaire' ? mondayOfWeekIso() : firstOfMonthIso();
}

export function RecapPdfButton({ party }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => defaultFrom(party.modalite_facturation));
  const [to, setTo] = useState(todayIso());

  function onConfirm() {
    const url =
      `/api/admin/donneurs-ordres/recap/pdf?ordering_party=${encodeURIComponent(party.id)}` +
      `&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
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
        aria-label={`Récap PDF de ${party.raison_sociale}`}
      >
        <FileText className="h-12 w-12" aria-hidden />
        Récap PDF
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Récap PDF — {party.raison_sociale}</DialogTitle>
            <DialogDescription>
              Génère un PDF récapitulatif des courses du donneur d&apos;ordres sur la période
              choisie, pour sa facturation centralisée.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-12 py-12">
            <div className="space-y-4">
              <Label htmlFor={`recap-from-${party.id}`}>Du</Label>
              <DateFieldFr id={`recap-from-${party.id}`} value={from} onChange={setFrom} />
            </div>
            <div className="space-y-4">
              <Label htmlFor={`recap-to-${party.id}`}>Au</Label>
              <DateFieldFr id={`recap-to-${party.id}`} value={to} onChange={setTo} />
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
