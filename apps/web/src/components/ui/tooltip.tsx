'use client';

import * as React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

/**
 * <Tooltip> — primitive infobulle (Phase 06.66, DEC-146), sur Radix Tooltip
 * (cohérent avec Dialog/Sheet/DropdownMenu déjà Radix). Implémente la spec
 * WAI-ARIA 1.2 (role tooltip, `aria-describedby`, focus Tab, Escape) et
 * WCAG 1.4.13 (dismissable / hoverable / persistant) GRATUITEMENT — là où un
 * tooltip CSS pur échoue sur tactile et lecteurs d'écran.
 *
 * Ancrée au trigger (jamais « qui suit le curseur » — anti-pattern a11y),
 * déclenchée au survol ET au focus clavier. Ne doit jamais porter une info
 * critique en accès UNIQUE (toujours un filet ailleurs).
 *
 * `TooltipProvider` est monté une fois au layout app (delayDuration global).
 */
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'bg-foreground text-background z-50 max-w-[280px] rounded-md px-12 py-8 text-xs shadow-md',
        'data-[state=delayed-open]:animate-in data-[state=closed]:animate-out',
        'data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0',
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
