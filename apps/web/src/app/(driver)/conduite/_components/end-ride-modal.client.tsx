'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Banknote,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { endRideAction } from '../actions';

type PaymentMethod = 'cash' | 'cb' | 'cheque' | 'cgss_differe';

interface MethodChoice {
  value: PaymentMethod;
  label: string;
  Icon: LucideIcon;
}

const METHODS: MethodChoice[] = [
  { value: 'cash', label: 'Espèces', Icon: Banknote },
  { value: 'cb', label: 'Carte', Icon: CreditCard },
  { value: 'cheque', label: 'Chèque', Icon: FileText },
  { value: 'cgss_differe', label: 'CGSS différé', Icon: Clock },
];

interface Props {
  rideId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Modal de clôture chauffeur (Phase 3 / 03-E).
 *
 * Layout responsive : bottom-sheet sur mobile (inset-x-0 bottom-0,
 * rounded-t-xl), centré sur ≥ sm (référence Stripe Checkout mobile +
 * Mercury). Inputs gros et tactiles, focus immédiat sur le tarif.
 *
 * Submission : endRideAction (en_cours → terminee + tarif + paiement).
 * Toast Sonner sur succès, refresh route pour recharger la liste.
 */
export function EndRideModal({
  rideId,
  open,
  onOpenChange,
}: Props): JSX.Element {
  const router = useRouter();
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<PaymentMethod>('cash');
  const [encaisseNow, setEncaisseNow] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (open) {
      setAmount('');
      setMethod('cash');
      setEncaisseNow(true);
      // Léger délai pour laisser le modal s'animer avant le focus.
      const t = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [open]);

  const submit = async () => {
    const numeric = Number.parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(numeric) || numeric < 0) {
      toast.error('Montant invalide.');
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    const res = await endRideAction({
      rideId,
      tarif_amount_eur: numeric,
      payment_status: encaisseNow ? 'encaisse' : 'a_encaisser',
      payment_method: method,
    });
    setPending(false);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success('Course clôturée.');
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Mobile : bottom-sheet pleine largeur
          'fixed inset-x-0 bottom-0 left-0 right-0 top-auto w-full max-w-none',
          'translate-x-0 translate-y-0 rounded-t-xl rounded-b-none border-x-0 border-b-0',
          // Desktop ≥ sm : recentré au milieu
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:max-w-md',
          'sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border',
          'p-24 gap-16 max-h-[92vh] overflow-y-auto',
        )}
      >
        <div className="space-y-4">
          <DialogTitle className="text-lg">Clôturer la course</DialogTitle>
          <DialogDescription className="text-sm">
            Saisir le tarif et le moyen de paiement.
          </DialogDescription>
        </div>

        <div className="space-y-4">
          <label
            htmlFor="end-ride-amount"
            className="text-xs font-medium text-muted-foreground"
          >
            Tarif
          </label>
          <div className="relative">
            <input
              id="end-ride-amount"
              ref={inputRef}
              type="text"
              inputMode="decimal"
              step={0.5}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              aria-label="Tarif en euros"
              className={cn(
                'w-full rounded-md border border-input bg-background px-16 pr-32 py-12',
                'text-3xl font-semibold tabular-nums',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            />
            <span
              aria-hidden
              className="absolute right-16 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground"
            >
              €
            </span>
          </div>
        </div>

        <div className="space-y-8">
          <span className="text-xs font-medium text-muted-foreground">
            Moyen de paiement
          </span>
          <div
            role="radiogroup"
            aria-label="Moyen de paiement"
            className="grid grid-cols-2 gap-8"
          >
            {METHODS.map((m) => {
              const active = m.value === method;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    'flex flex-col items-center justify-center gap-4 rounded-md border px-12 py-16 transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted/50',
                  )}
                >
                  <m.Icon className="h-24 w-24" aria-hidden />
                  <span className="text-sm font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={encaisseNow}
          onClick={() => setEncaisseNow((v) => !v)}
          className={cn(
            'flex h-14 items-center justify-between gap-12 rounded-md border border-border bg-background px-16',
            'transition-colors duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          <span className="flex flex-col items-start gap-4">
            <span className="text-sm font-medium">
              {encaisseNow ? 'Encaissé maintenant' : 'À encaisser plus tard'}
            </span>
            <span className="text-xs text-muted-foreground">
              {encaisseNow
                ? 'Le paiement est enregistré comme reçu.'
                : 'Reste à encaisser, à régulariser ensuite.'}
            </span>
          </span>
          <span
            aria-hidden
            className={cn(
              'relative inline-flex h-24 w-48 shrink-0 items-center rounded-full transition-colors duration-150',
              encaisseNow ? 'bg-success' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'absolute inline-block h-16 w-16 rounded-full bg-background shadow-sm transition-transform duration-150',
                encaisseNow ? 'translate-x-[28px]' : 'translate-x-4',
              )}
            />
          </span>
        </button>

        <Button
          type="button"
          onClick={submit}
          disabled={pending || !amount}
          className="h-14 w-full text-base font-semibold"
        >
          {pending ? (
            <>
              <Loader2 className="mr-8 h-16 w-16 animate-spin" aria-hidden />
              Clôture…
            </>
          ) : (
            'Clôturer la course'
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
