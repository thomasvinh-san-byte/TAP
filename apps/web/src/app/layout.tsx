import './globals.css';
import type { Metadata } from 'next';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'TAP Réunion — Régulation',
  description:
    'Régulation, optimisation et communication patient pour TAP et taxis conventionnés CGSS.',
};

/**
 * Script anti-FOUC : positionne `data-theme` sur <html> AVANT le rendu React,
 * évite le flash mode jour → mode nuit. Pas de dépendance package (next-themes
 * écarté par DEC-021 « CSS vars uniquement »).
 */
const themeBootstrap = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'dark' || stored === 'light' ? stored : (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {
    /* localStorage indisponible (mode privé strict) — fallback mode jour. */
  }
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        {children}
        {/* Toaster Sonner monté au layout racine (Rule 3 — PLAN-4 §4.3) :
            les routes (auth) et (driver) émettent des toasts (LoginForm,
            AcceptInviteForm, ActivationToast). Le Toaster précédemment
            monté dans (app)/providers.client.tsx a été retiré pour éviter
            la duplication — ce Toaster racine couvre tous les groupes. */}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
