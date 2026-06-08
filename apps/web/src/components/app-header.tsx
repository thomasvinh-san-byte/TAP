import Link from 'next/link';
import type { ReactNode } from 'react';
import { navForRole } from '@/lib/nav-config';
import { NavTabs } from '@/components/nav-tabs.client';
import { NavGroupMenu } from '@/components/nav-group-menu.client';
import { LegalNavMenu } from '@/components/legal-nav-menu.client';
import { UserMenu } from '@/components/user-menu';

/**
 * <AppHeader> — barre de navigation principale partagée par
 * `(app)/layout.tsx` et `(admin)/layout.tsx` (Phase 06.36, DEC-115).
 *
 * Auparavant dupliqué à l'identique dans les deux layouts. Factorisé
 * pour qu'une évolution d'incarnation (signature bleue de l'actif,
 * présence du logo, séparation header/contenu) soit cohérente partout.
 *
 * Direction §3 appliquée :
 *   - **Logo « TAP »** en `text-primary` — la marque porte l'identité,
 *     « Régulation » reste muted (étiquette).
 *   - **NavTabs** : onglet actif en `text-primary` + soulignement 3px
 *     pleine opacité (signature lisible — direction §3 « bleu profond =
 *     nav active »).
 *   - **Séparation** : `border-b` + `shadow-sm` pour détacher le header
 *     du contenu sans lourdeur (sticky + backdrop-blur conservés).
 *
 * Phase 06.38 (DEC-117) : regroupement de la nav dirigeant via
 * `<NavGroupMenu />` (Flotte ▾, Gestion ▾) pour rester sous le seuil
 * secteur 5-7. Régulateur (5 entrées) conservé à plat.
 *
 * Header PWA chauffeur **hors périmètre** — grammaire dédiée (DEC-014).
 */
interface Props {
  role: 'dirigeant' | 'regulateur';
  /** Slot d'extras avant le UserMenu (ex. DraftQueue côté `(app)`). */
  extras?: ReactNode;
}

export function AppHeader({ role, extras }: Props): JSX.Element {
  const nav = navForRole(role);
  const isDirigeant = role === 'dirigeant';

  return (
    <header
      className={
        'border-border sticky top-0 z-40 h-14 w-full border-b shadow-sm ' +
        'bg-background/85 supports-[backdrop-filter]:bg-background/70 backdrop-blur'
      }
    >
      <div className="flex h-full items-center justify-between gap-24 px-24">
        <Link
          href="/patients"
          className="focus-visible:ring-ring flex items-baseline gap-8 rounded-sm focus-visible:outline-none focus-visible:ring-2"
        >
          <span className="text-primary text-base font-semibold tracking-tight">TAP</span>
          <span className="text-muted-foreground text-sm">Régulation</span>
        </Link>
        <div className="flex h-full items-center gap-32">
          <NavTabs tabs={nav.primary} />
          {nav.groups.map((group) => (
            <NavGroupMenu key={group.label} group={group} />
          ))}
          {isDirigeant && <LegalNavMenu />}
        </div>
        <div className="flex items-center gap-16">
          {extras}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
