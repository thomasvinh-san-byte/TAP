'use client';

/**
 * ActivationToast — déclenche le toast Sonner « Compte activé » à l'arrivée
 * sur /conduite après acceptation invitation (FLAG #1, PLAN-4 §4.8bis).
 *
 * `acceptInvitationAction` redirige vers `/conduite?activated=1` côté serveur ;
 * ce Client Component lit `useSearchParams()` au mount, émet le toast une
 * seule fois, puis nettoie le param URL via `router.replace` pour éviter de
 * re-déclencher au reload.
 *
 * Pas d'UI rendue — composant retour `null`.
 */

import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function ActivationToast() {
  const sp = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    if (sp.get('activated') === '1') {
      toast.success("Compte activé. Bienvenue dans l'application chauffeur.");
      // Nettoie le param URL pour éviter de re-déclencher au reload.
      const url = new URL(window.location.href);
      url.searchParams.delete('activated');
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [sp, router]);

  return null;
}
