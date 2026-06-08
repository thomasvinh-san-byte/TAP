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
  title: { default: 'TAP Régulation', template: '%s · TAP Régulation' },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-24 py-16">
          <Link href="/" className="font-semibold tracking-tight">
            TAP Régulation
          </Link>
          <Link
            href="/login"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Connexion
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[840px] flex-1 px-24 py-48">{children}</main>
      <Footer />
      <CookieBanner />
    </div>
  );
}
