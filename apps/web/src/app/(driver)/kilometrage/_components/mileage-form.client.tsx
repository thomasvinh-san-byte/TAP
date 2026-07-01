'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { enqueue } from '@/lib/offline/sync-engine';

/**
 * Saisie du relevé kilométrique du jour (PWA-04, §5.16).
 *
 * Deux champs (compteur début / fin), grands et à clavier numérique (usage au
 * volant). En ligne : POST `/api/driver/mileage`. Hors-ligne ou 5xx : mise en
 * file (`save_mileage`) rejouée à la reconnexion, comme les transitions de
 * course — même mécanisme, pas de nouveau.
 */

interface Props {
  jour: string;
  kmStart: number | null;
  kmEnd: number | null;
}

const onlyDigits = (v: string) => v.replace(/\D/g, '').slice(0, 7);

export function MileageForm({ jour, kmStart, kmEnd }: Props): JSX.Element {
  const router = useRouter();
  const [start, setStart] = React.useState(kmStart?.toString() ?? '');
  const [end, setEnd] = React.useState(kmEnd?.toString() ?? '');
  const [pending, setPending] = React.useState(false);

  async function save() {
    const km_start = start.trim() === '' ? undefined : Number(start);
    const km_end = end.trim() === '' ? undefined : Number(end);

    if (km_start === undefined && km_end === undefined) {
      toast.error('Renseignez le kilométrage de début ou de fin.');
      return;
    }
    if (km_start !== undefined && km_end !== undefined && km_end < km_start) {
      toast.error('Le kilométrage de fin doit être supérieur ou égal à celui de début.');
      return;
    }

    const payload: Record<string, unknown> = { jour };
    if (km_start !== undefined) payload.km_start = km_start;
    if (km_end !== undefined) payload.km_end = km_end;

    setPending(true);
    try {
      if (!navigator.onLine) throw new Error('offline');
      const res = await fetch('/api/driver/mileage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idempotency_key: crypto.randomUUID(), ...payload }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (res.status >= 400 && res.status < 500) {
          toast.error(data.error ?? 'Enregistrement impossible.');
          setPending(false);
          return;
        }
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      toast.success('Kilométrage enregistré.');
      router.refresh();
    } catch {
      await enqueue({ type: 'save_mileage', resource_id: jour, payload });
      toast.warning('Kilométrage enregistré : synchronisation au retour du réseau.');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="border-border bg-background space-y-16 rounded-lg border p-16 shadow-sm">
      <div className="space-y-8">
        <Label htmlFor="km-start" className="text-base">
          Compteur en début de journée
        </Label>
        <Input
          id="km-start"
          inputMode="numeric"
          autoComplete="off"
          value={start}
          onChange={(e) => setStart(onlyDigits(e.target.value))}
          placeholder="km"
          className="h-14 text-lg tabular-nums"
        />
      </div>

      <div className="space-y-8">
        <Label htmlFor="km-end" className="text-base">
          Compteur en fin de journée
        </Label>
        <Input
          id="km-end"
          inputMode="numeric"
          autoComplete="off"
          value={end}
          onChange={(e) => setEnd(onlyDigits(e.target.value))}
          placeholder="km"
          className="h-14 text-lg tabular-nums"
        />
      </div>

      <Button
        type="button"
        onClick={() => void save()}
        disabled={pending}
        className="h-14 w-full text-base"
      >
        {pending ? 'Enregistrement…' : 'Enregistrer le relevé'}
      </Button>
    </div>
  );
}
