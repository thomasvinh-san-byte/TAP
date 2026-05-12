import './globals.css';
import type { Metadata } from 'next';

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
        {/* Phase 03.2.5 — point d'ancrage Portal pour react-datepicker
            (DateTimeFields modal saisie course). Sortir le picker du
            Sheet Radix évite toute collision z-index / focus-trap. */}
        <div id="datepicker-portal" />
      </body>
    </html>
  );
}
