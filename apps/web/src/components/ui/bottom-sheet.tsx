'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

/**
 * <BottomSheet> — feuille ancrée en bas, réutilisable (Phase 06.55, DEC-134).
 *
 * Doctrine mobile chauffeur : sur mobile, les modales d'action deviennent des
 * bottom-sheets (pas des boîtes centrées) — le pouce est déjà en bas, les
 * actions partent du bas de carte (sourcé Material / LogRocket). Construit sur
 * Radix Dialog → focus trap, `aria-modal`, fermeture Escape + backdrop
 * GRATUITS (RGAA). Ajoute : poignée de glissement + drag-to-dismiss tactile.
 *
 * Fermeture : swipe vers le bas (poignée), clic backdrop, Escape, ou les
 * boutons d'action fournis en `children`. `prefers-reduced-motion` neutralise
 * animations + transition de snap-back (règle globale globals.css).
 *
 * `title` est OBLIGATOIRE (a11y Radix). `description` optionnelle.
 */

const DISMISS_THRESHOLD_PX = 96;

export interface BottomSheetProps extends Omit<
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>,
  'title'
> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  ...contentProps
}: BottomSheetProps): JSX.Element {
  const [dragY, setDragY] = React.useState(0);
  const draggingRef = React.useRef(false);
  const startYRef = React.useRef(0);

  function onPointerDown(e: React.PointerEvent): void {
    draggingRef.current = true;
    startYRef.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent): void {
    if (!draggingRef.current) return;
    const dy = e.clientY - startYRef.current;
    // Glissement vers le bas uniquement (pas de remontée au-delà du repos).
    if (dy > 0) setDragY(dy);
  }

  function onPointerUp(): void {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (dragY > DISMISS_THRESHOLD_PX) {
      onOpenChange(false);
    }
    setDragY(0);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/60" />
        <DialogPrimitive.Content
          className={cn(
            'bg-background fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-[640px]',
            'flex-col rounded-t-2xl border-t shadow-lg',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            'pb-[max(env(safe-area-inset-bottom),16px)]',
            className,
          )}
          style={
            dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined
          }
          {...contentProps}
        >
          {/* Poignée de glissement — drag-to-dismiss tactile. */}
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="flex shrink-0 cursor-grab touch-none justify-center pb-8 pt-12 active:cursor-grabbing"
            aria-hidden
          >
            <span className="bg-muted-foreground/30 h-4 w-40 rounded-full" />
          </div>

          <div className="px-24 pb-8">
            <DialogPrimitive.Title className="text-foreground text-lg font-semibold">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-muted-foreground mt-4 text-sm">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>

          <div className="flex-1 space-y-16 overflow-y-auto px-24 pt-8">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
