'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'sonner';
import { Banknote, Clock, CreditCard, FileText, Loader2, type LucideIcon } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { enqueue } from '@/lib/offline/sync-engine';
import { getDb } from '@/lib/offline/dexie-instance';

type PaymentMethod = 'cash' | 'cb' | 'cheque' | 'cgss_differe';

interface MethodChoice {
  value: PaymentMethod;
  label: string;
  Icon: LucideIcon;
}

const METHODS: MethodChoice[] = [
  { value: 'cash', label: 'Cash', Icon: Banknote },
  { value: 'cb', label: 'CB', Icon: CreditCard },
  { value: 'cheque', label: 'Chèque', Icon: FileText },
  { value: 'cgss_differe', label: 'CGSS différé', Icon: Clock },
];

interface Props {
  rideId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

/**
 * Clôture de course en BOTTOM-SHEET (Phase 06.55 DEC-134 D-03 — doctrine
 * mobile chauffeur). Feuille ancrée en bas (zone pouce), poignée +
 * drag-to-dismiss, boutons larges en bas. Inputs gros et tactiles, focus
 * immédiat sur le tarif (inputMode="decimal" — clavier chiffres),
 * format virgule française accepté.
 *
 * Submission : endRideAction (en_cours → terminee + tarif + paiement).
 * Toast Sonner sur succès, refresh route pour recharger la liste.
 */
export function EndRideModal({ rideId, open, onOpenChange }: Props): JSX.Element {
  const router = useRouter();
  const [amount, setAmount] = React.useState('');
  const [method, setMethod] = React.useState<PaymentMethod>('cash');
  const [encaisseNow, setEncaisseNow] = React.useState(true);
  const [pending, setPending] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Track mutations en queue Dexie pour ce ride (Phase 04.9-bis #3).
  // Cf ride-actions.client.tsx, même pattern industry 2026.
  const pendingForThisRide = useLiveQuery(
    () => {
      if (typeof window === 'undefined') return 0;
      return getDb()
        .mutations_queue.where('resource_id')
        .equals(rideId)
        .filter((m) => m.status !== 'dead')
        .count();
    },
    [rideId],
    0,
  );
  const hasPendingSync = (pendingForThisRide ?? 0) > 0;

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

    const payload = {
      tarif_amount_eur: numeric,
      payment_status: encaisseNow ? 'encaisse' : 'a_encaisser',
      payment_method: method,
    };
    const idempotency_key = crypto.randomUUID();

    try {
      if (!navigator.onLine) {
        throw new Error('offline');
      }

      const res = await fetch(`/api/driver/rides/${rideId}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key, ...payload }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        const errorMsg = data.error ?? `HTTP ${res.status}`;

        if (res.status >= 400 && res.status < 500) {
          toast.error(errorMsg);
          setPending(false);
          return;
        }

        throw new Error(errorMsg);
      }

      toast.success('Course clôturée.');
      onOpenChange(false);
      router.refresh();
    } catch {
      await enqueue({
        type: 'end_ride',
        resource_id: rideId,
        payload,
      });
      toast.warning('Clôture enregistrée : sync au retour réseau.');
      onOpenChange(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Clôturer la course"
      description="Saisis le tarif et le mode de paiement."
      // Laisser le focus au tarif (pas à la poignée) à l'ouverture.
      onOpenAutoFocus={(e) => e.preventDefault()}
    >
      <div className="space-y-16 pb-8">
        <div className="space-y-4">
          <label htmlFor="end-ride-amount" className="text-muted-foreground text-xs font-medium">
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
                'border-input bg-background w-full rounded-md border px-16 py-12 pr-32',
                'text-3xl font-semibold tabular-nums',
                'focus-visible:ring-ring transition-colors focus-visible:outline-none focus-visible:ring-2',
              )}
            />
            <span
              aria-hidden
              className="text-muted-foreground absolute right-16 top-1/2 -translate-y-1/2 text-2xl font-semibold"
            >
              €
            </span>
          </div>
        </div>

        <div className="space-y-8">
          <span className="text-muted-foreground text-xs font-medium">Moyen de paiement</span>
          <div role="radiogroup" aria-label="Moyen de paiement" className="grid grid-cols-2 gap-8">
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
                    'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
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
          aria-label="Encaissé maintenant"
          onClick={() => setEncaisseNow((v) => !v)}
          className={cn(
            'bg-muted flex items-center justify-between gap-12 rounded-md px-16 py-12',
            'hover:bg-muted/80 focus-visible:ring-ring transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2',
          )}
        >
          <span className="text-sm font-medium">Encaissé maintenant</span>
          <span
            aria-hidden
            className={cn(
              'relative inline-flex h-24 w-48 shrink-0 items-center rounded-full transition-colors duration-150',
              encaisseNow ? 'bg-success' : 'bg-muted-foreground/40',
            )}
          >
            <span
              className={cn(
                'bg-background absolute inline-block h-16 w-16 rounded-full shadow-sm transition-transform duration-150',
                encaisseNow ? 'translate-x-[28px]' : 'translate-x-4',
              )}
            />
          </span>
        </button>

        <Button
          type="button"
          onClick={submit}
          disabled={pending || !amount || hasPendingSync}
          className="h-14 w-full text-base font-semibold"
        >
          {pending ? (
            <>
              <Loader2 className="mr-8 h-16 w-16 animate-spin" aria-hidden />
              Clôture…
            </>
          ) : hasPendingSync ? (
            'Clôture en attente de sync…'
          ) : (
            'Clôturer la course'
          )}
        </Button>
      </div>
    </BottomSheet>
  );
}
