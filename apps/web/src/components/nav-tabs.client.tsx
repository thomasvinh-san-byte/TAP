'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavTab {
  href: string;
  label: string;
}

interface NavTabsProps {
  tabs: NavTab[];
}

/**
 * Onglets de navigation principale du shell régulateur.
 *
 * État actif détecté via `usePathname` (segment startsWith). Underline animé
 * 150ms ease-out sur l'onglet actif, couleur primaire. Hover sur inactif :
 * passe en text-foreground.
 */
export function NavTabs({ tabs }: NavTabsProps): JSX.Element {
  const pathname = usePathname() ?? '';
  // Onglet actif = le href le plus spécifique (le plus long) qui correspond au
  // chemin courant — évite que « Courses » (/courses) reste souligné en même
  // temps que « Caisse » (/courses/caisse).
  const activeHref = tabs.reduce<string | null>((longest, tab) => {
    const matches = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
    if (!matches) return longest;
    return longest && longest.length >= tab.href.length ? longest : tab.href;
  }, null);
  return (
    <nav aria-label="Navigation principale" className="flex h-full items-center gap-32">
      {tabs.map((tab) => {
        const active = tab.href === activeHref;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative inline-flex h-full items-center text-sm transition-colors duration-150',
              'focus-visible:ring-ring rounded-sm focus-visible:outline-none focus-visible:ring-2',
              active
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{tab.label}</span>
            <span
              aria-hidden
              className={cn(
                'bg-primary absolute inset-x-0 -bottom-[1px] h-[2px] transition-opacity duration-150',
                active ? 'opacity-100' : 'opacity-0',
              )}
            />
          </Link>
        );
      })}
    </nav>
  );
}
