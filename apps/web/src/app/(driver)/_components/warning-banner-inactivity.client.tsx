'use client';

/**
 * WarningBannerInactivity — Phase 04.9 Wave 5 + DEC-022.
 *
 * Banner non-bloquant top main qui s'affiche si la PWA n'a pas été
 * utilisée depuis > 7 jours (mitigation iOS purge IndexedDB ~2 semaines
 * inactivité, cf magicbell research PR #110).
 *
 * Dismiss permanent via flag IndexedDB (`warningInactivityDismissed`).
 *
 * Refs : PLAN-5, DEC-022 LOCKED, UI-SPEC PR #110 wireframe.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getDb } from '@/lib/offline/dexie-instance';
import { Button } from '@/components/ui/button';

const SEVEN_DAYS_MS = 7 * 24 * 3600 * 1000;
const LAST_USED_KEY = 'lastUsedAt';
const DISMISSED_KEY = 'warningInactivityDismissed';

export function WarningBannerInactivity(): JSX.Element | null {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    (async () => {
      try {
        const db = getDb();
        const lastUsed = await db.app_meta.get(LAST_USED_KEY);
        const dismissed = await db.app_meta.get(DISMISSED_KEY);

        if (!lastUsed) return; // fresh start, pas de warning

        const lastMs = Number(lastUsed.value);
        const now = Date.now();
        if (now - lastMs > SEVEN_DAYS_MS && !dismissed?.value) {
          setShow(true);
        }
      } catch (err) {
        console.warn('[WarningBanner] Failed to check lastUsedAt:', err);
      }
    })();
  }, []);

  const dismiss = async () => {
    try {
      const db = getDb();
      await db.app_meta.put({ key: DISMISSED_KEY, value: true });
    } catch (err) {
      console.warn('[WarningBanner] Failed to dismiss:', err);
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      role="alert"
      className="mb-16 flex items-start gap-12 rounded-md border border-amber-200 bg-amber-50 p-12 text-amber-900"
    >
      <AlertTriangle aria-hidden className="mt-2 h-20 w-20 shrink-0" />
      <div className="flex-1 text-sm">
        Bienvenue. Si tu as un problème de chargement, ferme et relance l&apos;app.
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={dismiss}
        className="h-56 shrink-0"
        aria-label="Compris, masquer cet avertissement"
      >
        Compris
      </Button>
    </div>
  );
}
