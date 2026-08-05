'use client';

import * as React from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { updateRidePaymentAction } from '../actions';

interface Props {
  rideId: string;
  defaultAmountEur: number | null | undefined;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}

const METHOD_ITEMS = [
  { value: 'cash', label: 'Espèces' },
  { value: 'cb', label: 'Carte bancaire' },
  { value: 'cheque', label: 'Chèque' },
  { value: 'cgss_differe', label: 'CGSS différé' },
];

/**
 * Modal d'encaissement (Phase 3 / 03-D).
 * Pré-rempli avec le tarif courant. Au submit : payment_status = 'encaisse'.
 */
export function RidePaymentPopover({
  rideId,
  defaultAmountEur,
  open,
  onOpenChange,
  onDone,
}: Props): JSX.Element {
  const [amount, setAmount] = React.useState<string>(
    defaultAmountEur != null ? defaultAmountEur.toFixed(2) : '',
  );
  const [method, setMethod] = React.useState<string>('cash');
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAmount(defaultAmountEur != null ? defaultAmountEur.toFixed(2) : '');
      setMethod('cash');
    }
  }, [open, defaultAmountEur]);

  const submit = async () => {
    const numeric = Number.parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric < 0) {
      toast.error('Montant invalide.');
      return;
    }
    setPending(true);
    const res = await updateRidePaymentAction({
      rideId,
      tarif_amount_eur: numeric,
      payment_status: 'encaisse',
      payment_method: method as 'cash' | 'cb' | 'cheque' | 'cgss_differe',
    });
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Encaissement enregistré.');
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Encaisser la course</DialogTitle>
          <DialogDescription>Saisir le montant et le moyen de paiement.</DialogDescription>
        </DialogHeader>
        <div className="space-y-12">
          <label className="flex flex-col gap-4">
            <span className="text-muted-foreground text-xs font-medium">Montant (€)</span>
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="tabular-nums"
              aria-label="Montant à encaisser en euros"
            />
          </label>
          <div className="flex flex-col gap-4">
            <span className="text-muted-foreground text-xs font-medium">Moyen de paiement</span>
            <Select
              ariaLabel="Moyen de paiement"
              value={method}
              onChange={setMethod}
              items={METHOD_ITEMS}
              triggerClassName="w-full"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button type="button" variant="accent" onClick={submit} disabled={pending}>
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
