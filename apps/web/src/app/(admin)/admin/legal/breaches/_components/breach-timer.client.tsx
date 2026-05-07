'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Compteur 72h breach (D-08, DPA-05).
 *
 * Code couleur sémantique :
 * - text-success : > 24h restantes
 * - text-warning : 6-24h restantes
 * - text-destructive : < 6h ou délai dépassé
 *
 * setInterval 1s + cleanup au unmount. tabular-nums anti-shift digits.
 */
export function BreachTimer({ detectedAt }: { detectedAt: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const deadline = new Date(detectedAt).getTime() + 72 * 3_600_000;
  const remainingMs = deadline - now;
  const remainingHours = remainingMs / 3_600_000;
  const days = Math.floor(remainingHours / 24);
  const hours = Math.floor(remainingHours % 24);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);

  const tone =
    remainingHours > 24
      ? 'text-success'
      : remainingHours > 6
        ? 'text-warning'
        : 'text-destructive';

  if (remainingMs < 0) {
    return (
      <span
        data-testid="breach-countdown"
        className="font-mono tabular-nums text-destructive"
      >
        Délai dépassé
      </span>
    );
  }

  return (
    <span
      data-testid="breach-countdown"
      className={cn('font-mono tabular-nums', tone)}
    >
      J-{days} • {hours}h {minutes.toString().padStart(2, '0')}m
    </span>
  );
}
