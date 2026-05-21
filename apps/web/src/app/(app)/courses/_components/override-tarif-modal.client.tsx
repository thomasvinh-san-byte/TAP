'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { overrideRideTarifAction } from '../actions';

/**
 * OverrideTarifModal — Surface B UI-SPEC Phase 04.7.
 *
 * Sheet latéral droit (UI-PATTERNS « Sheet édition ») permettant à
 * dirigeant + régulateur (DEC-029 esprit, A-02 reco b) de forcer le tarif
 * d'une course terminée avec motif obligatoire + trace audit_logs.
 *
 * - Tarif required > 0 max 999.99
 * - Motif required min 10 chars max 500
 * - Server Action overrideRideTarifAction (DEC-041 row count check)
 * - Toast Sonner success/error
 *
 * Refs : DEC-029 esprit, DEC-041, UI-SPEC Surface B.
 */

const MOTIF_MIN = 10;
const MOTIF_MAX = 500;
const TARIF_MAX = 999.99;

const SOURCE_LABEL: Record<string, string> = {
  manuel: 'Manuel',
  cgss_auto: 'CGSS auto',
  override: 'Override',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  currentTarifEur: number;
  pricingSource: string | null;
  onSuccess?: () => void;
}

function formatEur(n: number): string {
  return `${n.toFixed(2).replace('.', ',')} €`;
}

export function OverrideTarifModal({
  open,
  onOpenChange,
  rideId,
  currentTarifEur,
  pricingSource,
  onSuccess,
}: Props): JSX.Element {
  const [tarifInput, setTarifInput] = React.useState('');
  const [motif, setMotif] = React.useState('');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setTarifInput(currentTarifEur.toFixed(2));
      setMotif('');
    }
  }, [open, currentTarifEur]);

  const tarifNum = Number(tarifInput.replace(',', '.'));
  const tarifValid = Number.isFinite(tarifNum) && tarifNum > 0 && tarifNum <= TARIF_MAX;
  const motifTrimmed = motif.trim();
  const motifValid = motifTrimmed.length >= MOTIF_MIN && motifTrimmed.length <= MOTIF_MAX;
  const formValid = tarifValid && motifValid;

  const submit = React.useCallback(async () => {
    if (!formValid) return;
    setPending(true);
    const res = await overrideRideTarifAction({
      rideId,
      newTarifEur: tarifNum,
      reason: motifTrimmed,
    });
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Tarif modifié.');
    onSuccess?.();
    onOpenChange(false);
  }, [formValid, rideId, tarifNum, motifTrimmed, onOpenChange, onSuccess]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-[480px] flex-col sm:w-[520px]">
        <SheetHeader>
          <SheetTitle>Modifier le tarif</SheetTitle>
          <SheetDescription>
            L'override est tracé dans l'audit log avec acteur, ancien tarif, nouveau tarif et motif.
          </SheetDescription>
        </SheetHeader>

        <form
          className="mt-24 flex-1 space-y-24"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="border-border bg-muted/30 space-y-12 rounded-md border p-12 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tarif actuel</span>
              <span className="font-mono font-semibold tabular-nums">
                {formatEur(currentTarifEur)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Source actuelle</span>
              <Badge variant="secondary" className="font-normal">
                {pricingSource ? (SOURCE_LABEL[pricingSource] ?? pricingSource) : '—'}
              </Badge>
            </div>
          </div>

          <div className="space-y-8">
            <Label htmlFor="new-tarif">Nouveau tarif (€)</Label>
            <Input
              id="new-tarif"
              type="number"
              step={0.01}
              min={0.01}
              max={TARIF_MAX}
              inputMode="decimal"
              value={tarifInput}
              onChange={(e) => setTarifInput(e.target.value)}
              required
              aria-invalid={!tarifValid && tarifInput.length > 0}
              aria-describedby="new-tarif-help"
              className="font-mono tabular-nums"
            />
            <p id="new-tarif-help" className="text-muted-foreground text-xs">
              Valeur strictement positive, max 999,99 €.
            </p>
          </div>

          <div className="space-y-8">
            <Label htmlFor="motif">
              Motif d'override <span className="text-muted-foreground">(obligatoire)</span>
            </Label>
            <Textarea
              id="motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              rows={4}
              maxLength={MOTIF_MAX}
              required
              aria-invalid={!motifValid && motif.length > 0}
              aria-describedby="motif-help"
              placeholder="Ex : détour imposé par travaux Boulevard Vauban, +6 km estimés."
              className={cn(!motifValid && motif.length > 0 && 'border-destructive')}
            />
            <p id="motif-help" className="text-muted-foreground text-xs">
              {MOTIF_MIN} caractères minimum. ({motifTrimmed.length}/{MOTIF_MAX})
            </p>
          </div>
        </form>

        <SheetFooter className="border-border mt-24 flex flex-row items-center justify-end gap-12 border-t pt-16">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => void submit()}
            disabled={!formValid || pending}
            aria-disabled={!formValid || pending}
          >
            {pending ? 'Enregistrement…' : 'Confirmer'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
