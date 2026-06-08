'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { updateComplianceBlockingModeAction } from '../actions';

/**
 * <BlockingModeControl> — réglage organisation du contrôle conformité
 * à la planification (Phase 06.35, DEC-114).
 *
 * Granularité GLOBALE (un réglage par organisation, Q6). Raffinement
 * par type d'échéance = plus tard si besoin. Réservé dirigeant
 * (l'action serveur l'exige aussi).
 */

type Mode = 'warn' | 'block';

interface Props {
  initialMode: Mode;
}

export function BlockingModeControl({ initialMode }: Props): JSX.Element {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pending, startTransition] = useTransition();

  function onChange(next: Mode) {
    const previous = mode;
    setMode(next);
    startTransition(async () => {
      const res = await updateComplianceBlockingModeAction(next);
      if (res.error) {
        toast.error(res.error);
        setMode(previous);
        return;
      }
      toast.success(
        next === 'block'
          ? 'Mode « bloquer » activé : les entités non conformes ne pourront pas être assignées.'
          : 'Mode « avertir » activé : la régulatrice garde la main.',
      );
    });
  }

  return (
    <section
      aria-labelledby="blocking-mode-title"
      className="border-border space-y-12 rounded-lg border p-16"
    >
      <header className="space-y-4">
        <h2 id="blocking-mode-title" className="text-base font-semibold">
          Comportement en cas de non-conformité
        </h2>
        <p className="text-muted-foreground text-sm">
          Avertir : la régulatrice garde la main (assignation possible sous sa responsabilité).
          Bloquer : assignation refusée pour un chauffeur ou véhicule avec une échéance expirée
          (manuel et optimisation).
        </p>
      </header>

      <div className="flex items-center gap-12">
        <SegmentedControl<Mode>
          ariaLabel="Mode de blocage conformité"
          value={mode}
          onValueChange={onChange}
          options={[
            { value: 'warn', label: 'Avertir' },
            { value: 'block', label: 'Bloquer' },
          ]}
        />
        {pending && <span className="text-muted-foreground text-xs">Enregistrement…</span>}
      </div>
    </section>
  );
}
