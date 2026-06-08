'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { NavGroup } from '@/lib/nav-config';

/**
 * <NavGroupMenu> — menu déroulant générique pour la nav principale
 * (Phase 06.38, DEC-117).
 *
 * Généralisé du pattern `LegalNavMenu` (Phase 1.5) pour permettre
 * d'autres regroupements (Flotte ▾, Gestion ▾) sans duplication.
 *
 * Déclencheur stylé comme un onglet `NavTabs` : signature bleue active
 * (DEC-115, direction §3) — `text-primary font-medium` + soulignement
 * `bg-primary` 3px pleine opacité quand un item du groupe est actif.
 *
 * A11y : `DropdownMenu` shadcn gère la navigation clavier (ouverture
 * Espace/Entrée, navigation flèches, fermeture Échap) et l'aria. Trigger
 * porte `aria-current="page"` quand le groupe est actif.
 */

interface Props {
  group: NavGroup;
}

export function NavGroupMenu({ group }: Props): JSX.Element {
  const pathname = usePathname() ?? '';
  const active = group.activePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-current={active ? 'page' : undefined}
          className={cn(
            'relative inline-flex h-full items-center gap-4 text-sm transition-colors duration-150',
            'focus-visible:ring-ring rounded-sm focus-visible:outline-none focus-visible:ring-2',
            active ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span>{group.label}</span>
          <ChevronDown className="h-12 w-12" aria-hidden />
          <span
            aria-hidden
            className={cn(
              'bg-primary absolute inset-x-0 -bottom-[1px] h-[3px] rounded-t-sm transition-opacity duration-150',
              active ? 'opacity-100' : 'opacity-0',
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-[240px]">
        {group.items.map((item) => {
          const itemActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <DropdownMenuItem key={item.href} asChild>
              <Link
                href={item.href}
                aria-current={itemActive ? 'page' : undefined}
                className={cn('w-full', itemActive && 'text-primary font-medium')}
              >
                {item.label}
              </Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
