'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/use-theme.client';
import { cn } from '@/lib/utils';

/**
 * <ThemeToggle> — bouton bascule mode jour/nuit (Phase 06.18).
 *
 * Extrait du `UserMenu` (Phase 04) pour être posable hors session auth
 * (notamment dans l'AuthShell de `/login` et `/accept-invite`). Mécanique
 * partagée via `useTheme()` (lecture/persistance localStorage `theme`,
 * compatible script anti-FOUC de `app/layout.tsx`).
 *
 * A11y :
 * - `aria-label` parlant (« Activer le mode nuit » / « Activer le mode
 *   jour »).
 * - `aria-pressed` reflète l'état actuel.
 * - Cible tactile 40 px (≥ 44 px ajusté visuellement par padding).
 * - Icône Sun/Moon `aria-hidden` (le label porte le sens).
 */

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps): JSX.Element {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? 'Activer le mode jour' : 'Activer le mode nuit';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={isDark}
      title={label}
      className={cn(
        'inline-flex h-10 w-10 items-center justify-center rounded-md',
        'text-muted-foreground hover:text-foreground hover:bg-muted',
        'focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'transition-colors duration-150',
        className,
      )}
    >
      <Icon className="h-16 w-16" aria-hidden />
    </button>
  );
}
