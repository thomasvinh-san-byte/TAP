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

/**
 * Sous-menu « Légal » de la navigation admin — regroupe les 6 pages RGPD
 * (dirigeant uniquement) pour ne pas surcharger la barre d'onglets.
 *
 * Le déclencheur est stylé comme un onglet `NavTabs` (underline actif) ;
 * il est actif dès que le pathname est sous `/admin/legal/`.
 */

const LEGAL_LINKS = [
  { href: '/admin/legal/registre', label: 'Registre des traitements' },
  { href: '/admin/legal/breaches', label: 'Violations de données' },
  { href: '/admin/legal/dpa', label: 'DPA sous-traitants' },
  { href: '/admin/legal/dpia', label: "Analyses d'impact (DPIA)" },
  { href: '/admin/legal/dpo', label: 'Contact DPO' },
  { href: '/admin/legal/requests', label: 'Demandes RGPD patients' },
];

export function LegalNavMenu(): JSX.Element {
  const pathname = usePathname() ?? '';
  const active = pathname.startsWith('/admin/legal/');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-current={active ? 'page' : undefined}
          className={cn(
            'relative inline-flex h-full items-center gap-4 text-sm transition-colors duration-150',
            'focus-visible:ring-ring rounded-sm focus-visible:outline-none focus-visible:ring-2',
            active ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <span>Légal</span>
          <ChevronDown className="h-12 w-12" aria-hidden />
          <span
            aria-hidden
            className={cn(
              'bg-primary absolute inset-x-0 -bottom-[1px] h-[2px] transition-opacity duration-150',
              active ? 'opacity-100' : 'opacity-0',
            )}
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-[240px]">
        {LEGAL_LINKS.map((link) => (
          <DropdownMenuItem key={link.href} asChild>
            <Link href={link.href} className="w-full">
              {link.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
