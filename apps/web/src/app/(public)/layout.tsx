import type { Metadata } from 'next';
import Link from 'next/link';
import { Footer } from '@/components/footer';
import { CookieBanner } from '@/components/cookie-banner.client';

/**
 * Layout public (D-13 + D-21) — pages `/legal/*` accessibles SANS
 * authentification Supabase. Le middleware exclut explicitement
 * `/legal/*` du redirect login. Footer légal et bandeau cookies
 * présents systématiquement.
 */
export const metadata: Metadata = {
  title: { default: 'TAP Régulation', template: '%s — TAP Régulation' },
};

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="max-w-[1200px] mx-auto px-24 py-16 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-tight">
            TAP Régulation
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Connexion
          </Link>
        </div>
      </header>
      <main className="flex-1 max-w-[840px] mx-auto px-24 py-48 w-full">
        {children}
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
