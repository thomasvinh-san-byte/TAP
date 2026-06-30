'use client';

import * as React from 'react';
import { ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Confirmation par glissement (PWA-01, §5.16) — EN COMPLÉMENT du bouton géant,
 * jamais à la place. Le tactile DOIT glisser le curseur jusqu'au bout pour
 * confirmer (anti-appui accidentel à une main, en conduite). Accessibilité :
 * l'élément est un bouton (rôle + aria-label) activable au CLAVIER (Entrée/
 * Espace) — les utilisateurs clavier ne sont pas sujets aux appuis accidentels.
 * Un simple tap (sans glissement) ne confirme PAS. Cible ≥ 56 px.
 */

const CONFIRM_RATIO = 0.9; // proportion du parcours à atteindre pour confirmer

export function SlideToConfirm({
  label,
  onConfirm,
  disabled = false,
  className,
}: {
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
  className?: string;
}): JSX.Element {
  const trackRef = React.useRef<HTMLButtonElement>(null);
  const draggingRef = React.useRef(false);
  const [offset, setOffset] = React.useState(0); // px du curseur
  const [maxX, setMaxX] = React.useState(0);

  const THUMB = 48; // largeur du curseur (px)

  const computeMax = React.useCallback(() => {
    const w = trackRef.current?.clientWidth ?? 0;
    setMaxX(Math.max(0, w - THUMB - 8));
  }, []);

  React.useEffect(() => {
    computeMax();
    window.addEventListener('resize', computeMax);
    return () => window.removeEventListener('resize', computeMax);
  }, [computeMax]);

  const finish = React.useCallback(
    (x: number) => {
      draggingRef.current = false;
      if (maxX > 0 && x >= maxX * CONFIRM_RATIO) {
        setOffset(0);
        onConfirm();
      } else {
        setOffset(0); // retour animé à zéro (transition CSS)
      }
    },
    [maxX, onConfirm],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || disabled) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(Math.max(0, e.clientX - rect.left - THUMB / 2), maxX);
    setOffset(x);
  };
  const onPointerUp = () => {
    if (!draggingRef.current) return;
    finish(offset);
  };

  return (
    <button
      ref={trackRef}
      type="button"
      disabled={disabled}
      aria-label={`${label} (glisser pour confirmer, ou Entrée)`}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onConfirm();
        }
      }}
      className={cn(
        'relative flex h-14 w-full select-none items-center overflow-hidden rounded-md',
        'bg-primary/15 text-primary focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2',
        'disabled:opacity-60',
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-base font-semibold">
        {label}
      </span>
      <span
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ transform: `translateX(${offset}px)`, width: THUMB }}
        className={cn(
          'bg-primary text-primary-foreground absolute left-4 top-1/2 z-10 flex h-12 -translate-y-1/2',
          'cursor-grab touch-none items-center justify-center rounded-md active:cursor-grabbing',
          offset === 0 && 'transition-transform duration-150',
        )}
        aria-hidden
      >
        <ChevronsRight className="h-20 w-20" />
      </span>
    </button>
  );
}
