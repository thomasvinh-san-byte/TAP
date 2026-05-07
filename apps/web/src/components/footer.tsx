'use client';

import Link from 'next/link';
import { resetCookieConsent } from '@/lib/cookie-consent';

/**
 * Footer public (D-13 + D-14) — 5 liens légaux + lien permanent
 * « Gérer mes cookies » qui réinitialise le consentement et relance
 * le bandeau (CNIL : consentement révocable à tout moment).
 */
export function Footer() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="max-w-[1200px] mx-auto px-24 py-32 flex flex-wrap gap-24 text-sm text-muted-foreground">
        <Link href="/legal/cgu" className="hover:text-foreground transition-colors">
          CGU
        </Link>
        <Link href="/legal/cgv" className="hover:text-foreground transition-colors">
          CGV
        </Link>
        <Link
          href="/legal/confidentialite"
          className="hover:text-foreground transition-colors"
        >
          Politique de confidentialité
        </Link>
        <Link href="/legal/cookies" className="hover:text-foreground transition-colors">
          Cookies
        </Link>
        <Link href="/legal/dpo" className="hover:text-foreground transition-colors">
          Contact DPO
        </Link>
        <button
          type="button"
          onClick={resetCookieConsent}
          className="hover:text-foreground transition-colors"
        >
          Gérer mes cookies
        </button>
      </div>
    </footer>
  );
}
