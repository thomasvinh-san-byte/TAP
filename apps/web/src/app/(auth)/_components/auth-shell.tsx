import { type ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle.client';

interface AuthShellProps {
  children: ReactNode;
  title: string;
  footerHint?: ReactNode;
  rightSlot?: ReactNode; // pour DemoCredentials uniquement /login
}

/**
 * `<AuthShell>` — wrapper layout pour les surfaces auth (login, accept-invite).
 *
 * Phase 06.45 (DEC-124, supersede DEC-123) : abandon du split-screen. Le
 * contenu de marque TAP est léger (logo + baseline) → un split (panneau de
 * marque ~demi-page) était hors-norme (ratio inversé, panneau à moitié vide).
 * Pattern retenu : **formulaire CENTRÉ** une colonne (Notion/Linear ; B2B =
 * une colonne par défaut, chemin le plus court vers l'entrée).
 *
 * Composition : page centrée sur fond `bg-muted` sobre + carte
 * `bg-background` élévation légère (border + shadow-sm), largeur contenue
 * (max 400 px), marge sur mobile. En-tête de carte = marque + titre.
 *
 * Marque rendue **typographiquement** (pavé « T » `bg-primary` + mot « TAP »
 * `text-foreground`) plutôt que via `/logo-tap.svg` : le SVG a des couleurs
 * figées (« TAP » navy) qui deviendraient illisibles sur la carte en mode
 * nuit (fond quasi-noir). Le rendu par tokens reste lisible et AA jour ET
 * nuit, sans asset.
 *
 * Server Component (le toggle thème est l'îlot client `<ThemeToggle>`, placé
 * en coin haut-droite, atteignable au clavier). Padding échelle stricte
 * 4/8/12/16/24/32/48/64 (NFR-003).
 */
export function AuthShell({ children, title, footerHint, rightSlot }: AuthShellProps) {
  return (
    <div className="bg-muted relative flex min-h-screen flex-col items-center justify-center p-16">
      <div className="absolute right-16 top-16">
        <ThemeToggle />
      </div>

      <main className="w-full max-w-[400px]">
        <div className="border-border bg-background rounded-lg border p-32 shadow-sm">
          <div className="mb-24 flex flex-col items-center gap-16 text-center">
            {/* Marque typographique — couleurs par tokens (jour + nuit AA). */}
            <div className="flex items-center gap-8">
              <span
                className="bg-primary text-primary-foreground flex h-32 w-32 items-center justify-center rounded-md text-xl font-bold"
                aria-hidden
              >
                T
              </span>
              <span className="text-2xl font-semibold tracking-tight">TAP</span>
            </div>
            <h1 className="text-2xl font-semibold leading-tight">{title}</h1>
          </div>

          {children}

          {rightSlot ? <div className="pt-16">{rightSlot}</div> : null}
          {footerHint ? <p className="text-muted-foreground pt-16 text-sm">{footerHint}</p> : null}
        </div>

        <p className="text-muted-foreground mt-16 text-center text-sm">
          La régulation du transport sanitaire, sans friction.
        </p>
      </main>

      <footer className="text-muted-foreground absolute bottom-16 left-0 right-0 text-center text-xs">
        SaaS de régulation TAP · Réunion 974
      </footer>
    </div>
  );
}
