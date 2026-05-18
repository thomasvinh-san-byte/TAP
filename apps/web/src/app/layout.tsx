import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'TAP Réunion — Régulation',
  description:
    'Régulation, optimisation et communication patient pour TAP et taxis conventionnés CGSS.',
  icons: {
    icon: [
      { url: '/icons/icon-192-any.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512-any.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon-180.png',
    shortcut: '/icons/icon-192-any.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0944a0',
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
        {/* PWA meta tags — Phase 04.9 Wave 2, Option A cross-platform LOCKED */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TAP Chauffeur" />
        <link rel="manifest" href="/manifest.json" />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-launch-750x1334.png"
          media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-launch-1170x2532.png"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/splash/apple-launch-1290x2796.png"
          media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
        />
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
