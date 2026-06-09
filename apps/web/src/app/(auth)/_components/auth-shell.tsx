import { type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle.client';

interface AuthShellProps {
  children: ReactNode;
  title: string;
  footerHint?: ReactNode;
  rightSlot?: ReactNode; // pour DemoCredentials uniquement /login
}

const VALUE_POINTS = [
  'Régulation temps réel',
  'Optimisation des tournées',
  'Pilotage et conformité',
] as const;

/**
 * `<AuthShell>` — wrapper layout pour les surfaces auth (C05).
 *
 * Split desktop ≥ 1024 px (`lg:`), single column < 1024 px.
 *
 * Colonne identité gauche (Phase 06.44, DEC-123) : **bleu institutionnel**
 * `bg-primary text-primary-foreground` — le bleu porte l'identité (direction
 * DEC-101 §3), pas un gris terne. Marque rendue **typographiquement** (pas
 * d'asset) : pavé « T » + mot « TAP » colorés par tokens, donc lisibles ET
 * contrastés AA en jour (bleu profond / texte blanc) comme en nuit (bleu clair
 * / texte navy) — un SVG à couleurs figées casserait en nuit. Baseline forte +
 * 2-3 points de valeur sobres (masqués sur mobile, bandeau compact).
 *
 * Colonne form droite `bg-background` (titre 28 px + children + footerHint),
 * centrée et respirante. Le toggle thème (îlot client) reste en haut à droite.
 *
 * Server Component (le toggle est encapsulé dans `<ThemeToggle>`). Padding
 * échelle stricte 4/8/12/16/24/32/48/64 (NFR-003).
 */
export function AuthShell({ children, title, footerHint, rightSlot }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Colonne identité (gauche desktop, bandeau compact mobile) */}
      <aside
        className="bg-primary text-primary-foreground flex flex-col p-24 lg:flex-1 lg:p-48"
        aria-label="Identité produit"
      >
        <div className="flex flex-col justify-center gap-16 lg:flex-1 lg:gap-32">
          {/* Marque typographique — couleurs par tokens (jour + nuit AA). */}
          <div className="flex items-center gap-12">
            <span
              className="bg-primary-foreground text-primary flex h-40 w-40 items-center justify-center rounded-md text-2xl font-bold lg:h-48 lg:w-48 lg:text-3xl"
              aria-hidden
            >
              T
            </span>
            <span className="text-3xl font-semibold tracking-tight lg:text-4xl">TAP</span>
          </div>

          <h2 className="max-w-[460px] text-xl font-semibold leading-tight lg:text-3xl">
            La régulation du transport sanitaire, sans friction.
          </h2>

          <ul className="text-primary-foreground/80 hidden max-w-[460px] flex-col gap-12 lg:flex">
            {VALUE_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-8 text-base">
                <Check className="h-16 w-16 shrink-0" aria-hidden />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <footer className="text-primary-foreground/70 hidden pt-32 text-xs lg:block">
          SaaS de régulation TAP · Réunion 974
        </footer>
      </aside>

      {/* Colonne form (droite desktop, body mobile) */}
      <section className="bg-background flex w-full flex-col p-24 lg:w-[480px] lg:flex-shrink-0 lg:p-32">
        {/* Header 56 px — ThemeToggle pour l'utilisateur non connecté (D-05). */}
        <header className="flex h-14 items-center justify-end">
          <ThemeToggle />
        </header>
        <div className="flex flex-1 flex-col justify-center">
          <div className="mx-auto w-full max-w-[400px] space-y-24">
            <h1 className="text-[28px] font-semibold leading-[1.2]">{title}</h1>
            {children}
            {rightSlot ? <div className="pt-16">{rightSlot}</div> : null}
            {footerHint ? (
              <p className="text-muted-foreground pt-16 text-sm">{footerHint}</p>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
