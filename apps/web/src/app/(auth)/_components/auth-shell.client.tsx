'use client';

import { type ReactNode } from 'react';
import Image from 'next/image';

interface AuthShellProps {
  children: ReactNode;
  title: string;
  footerHint?: ReactNode;
  rightSlot?: ReactNode; // pour DemoCredentials uniquement /login
}

/**
 * `<AuthShell>` — wrapper React mode jour pour les surfaces auth (C05).
 *
 * Layout split desktop ≥ 1024 px (`lg:`), single column < 1024 px.
 * Colonne identité gauche `bg-muted` (logo + baseline + footer sobre).
 * Colonne form droite `bg-background` (titre 28 px + children + footerHint).
 *
 * Pas de toggle mode nuit Phase 04 (DEC-020 update — reporté Phase UI
 * dédiée). Le header `h-14` (56 px) côté form reste vide V1 mais est
 * réservé pour le futur toggle Sun/Moon.
 *
 * Padding échelle stricte 4/8/12/16/24/32/48/64 (NFR-003). Spec complète
 * UI-SPEC § 7.6.
 */
export function AuthShell({
  children,
  title,
  footerHint,
  rightSlot,
}: AuthShellProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Colonne identité (gauche desktop, header mobile) */}
      <aside
        className="bg-muted flex-1 flex flex-col justify-between p-24 lg:p-48"
        aria-label="Identité produit"
      >
        <header className="h-14" /> {/* Header 56 px vide V1 */}
        <div className="flex flex-col items-start gap-24">
          <Image
            src="/logo-tap.svg"
            alt="TAP"
            width={120}
            height={48}
            className="h-12 w-auto"
            priority
          />
          <p className="text-base text-muted-foreground leading-[1.5] max-w-[440px]">
            Régulation, optimisation, pilotage TAP/CGSS — 974
          </p>
        </div>
        <footer className="text-xs text-muted-foreground">
          SaaS de régulation TAP — Réunion 974
        </footer>
      </aside>

      {/* Colonne form (droite desktop, body mobile) */}
      <section className="bg-background w-full lg:w-[480px] lg:flex-shrink-0 flex flex-col p-24 lg:p-32">
        <header className="h-14" /> {/* Header 56 px — toggle nuit Phase UI future */}
        <div className="flex-1 flex flex-col justify-center">
          <div className="w-full max-w-[400px] mx-auto space-y-24">
            <h1 className="text-[28px] font-semibold leading-[1.2]">{title}</h1>
            {children}
            {rightSlot ? <div className="pt-16">{rightSlot}</div> : null}
            {footerHint ? (
              <p className="text-sm text-muted-foreground pt-16">{footerHint}</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
