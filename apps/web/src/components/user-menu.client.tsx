'use client';

import * as React from 'react';
import { LogOut, Moon, Settings, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { cn } from '@/lib/utils';
import { signOutAction } from '@/app/(auth)/actions';

type Role = 'dirigeant' | 'regulateur' | 'chauffeur';

interface UserMenuProps {
  prenom: string;
  nom: string;
  email: string;
  role: Role;
}

const ROLE_LABELS: Record<Role, string> = {
  dirigeant: 'Dirigeant·e',
  regulateur: 'Régulateur·rice',
  chauffeur: 'Chauffeur·se',
};

/**
 * Menu utilisateur dans le coin haut-droit du shell authentifié.
 *
 * - Trigger : InitialsAvatar 32px, couleur par rôle (dirigeant/régul/chauf).
 * - Dropdown 280px : identité, toggle mode jour/nuit, paramètres (V2),
 *   déconnexion. Persistance theme via localStorage clé `theme`
 *   (compatible avec le script anti-FOUC dans app/layout.tsx).
 */
export function UserMenu({ prenom, nom, email, role }: UserMenuProps): JSX.Element {
  const fullName = `${prenom} ${nom}`.trim();
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  const toggleTheme = React.useCallback(() => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    try {
      window.localStorage.setItem('theme', next);
    } catch {
      /* localStorage indisponible — préférence non persistée. */
    }
  }, [theme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Menu utilisateur — ${fullName}`}
          className={cn(
            'inline-flex items-center justify-center rounded-full',
            'transition-[box-shadow,transform] duration-150',
            'hover:ring-ring/30 hover:ring-offset-background hover:ring-2 hover:ring-offset-2',
            'focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'data-[state=open]:ring-ring data-[state=open]:ring-offset-background data-[state=open]:ring-2 data-[state=open]:ring-offset-2',
          )}
        >
          <InitialsAvatar name={fullName} role={role} size={32} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[280px]">
        <div className="flex flex-col gap-4 px-12 py-12">
          <span className="text-foreground truncate text-sm font-semibold">{fullName}</span>
          <span className="text-muted-foreground text-xs">{ROLE_LABELS[role]}</span>
          <span className="text-muted-foreground truncate text-xs">{email}</span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            toggleTheme();
          }}
          className="gap-12"
        >
          {theme === 'dark' ? (
            <Sun className="h-16 w-16" aria-hidden />
          ) : (
            <Moon className="h-16 w-16" aria-hidden />
          )}
          <span>{theme === 'dark' ? 'Mode jour' : 'Mode nuit'}</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled className="gap-12">
          <Settings className="h-16 w-16" aria-hidden />
          <span>Paramètres</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="text-destructive focus:text-destructive w-full gap-12">
              <LogOut className="h-16 w-16" aria-hidden />
              <span>Déconnexion</span>
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
