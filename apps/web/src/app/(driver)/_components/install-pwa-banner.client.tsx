'use client';

/**
 * InstallPwaBanner — Phase 04.9 post-clôture mini-PR #118.
 *
 * Banner discret en haut de /conduite qui incite le chauffeur à
 * installer la PWA sur son écran d'accueil. Pattern industry 2026
 * confirmé : custom banner avec visual cues plus efficace que texte
 * seul (junkangworld 2025), conversion +30-40% vs absence.
 *
 * 2 variantes selon state `useInstallPrompt()` :
 *   - android-ready : bouton « Installer l'app » déclenche prompt()
 *     natif Chrome. Accepté → toast confirmation. Refusé → dismiss 7j.
 *   - ios-safari : instructions visuelles « Touche Share icon puis
 *     Add to Home Screen ». Pas de bouton (pas d'API iOS).
 *
 * Dismiss flag IndexedDB avec re-apparition après 7j (cohérent UX
 * 2026 vs WarningBanner dismiss permanent).
 *
 * Refs : useInstallPrompt hook, WarningBannerInactivity pattern
 * Phase 04.9 Wave 5.
 */

import { useEffect, useState } from 'react';
import { Download, Plus, Share2, X } from 'lucide-react';
import { toast } from 'sonner';
import { getDb } from '@/lib/offline/dexie-instance';
import { Button } from '@/components/ui/button';
import { useInstallPrompt } from '../_lib/use-install-prompt';

const DISMISSED_KEY = 'pwaInstallDismissedAt';
const DISMISS_DURATION_MS = 7 * 24 * 3600 * 1000;

export function InstallPwaBanner(): JSX.Element | null {
  const promptState = useInstallPrompt();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      try {
        const row = await getDb().app_meta.get(DISMISSED_KEY);
        if (!row) {
          setDismissed(false);
          return;
        }
        const dismissedAt = Number(row.value);
        if (Date.now() - dismissedAt > DISMISS_DURATION_MS) {
          setDismissed(false);
        }
      } catch {
        setDismissed(false);
      }
    })();
  }, []);

  const dismiss = async () => {
    try {
      await getDb().app_meta.put({
        key: DISMISSED_KEY,
        value: Date.now(),
      });
    } catch (err) {
      console.warn('[InstallPwaBanner] Failed to persist dismiss:', err);
    }
    setDismissed(true);
  };

  if (
    promptState.kind === 'standalone' ||
    promptState.kind === 'unsupported'
  ) {
    return null;
  }
  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-label="Installation de l'application"
      className="mb-16 flex items-start gap-12 rounded-md border border-primary/20 bg-primary/5 p-12"
    >
      {promptState.kind === 'android-ready' ? (
        <>
          <Download
            aria-hidden
            className="h-20 w-20 shrink-0 text-primary mt-2"
          />
          <div className="flex-1 space-y-8">
            <p className="text-sm font-medium text-foreground">
              Installe TAP sur ton écran d&apos;accueil
            </p>
            <p className="text-xs text-muted-foreground">
              Accès rapide d&apos;un seul tap, plein écran, fonctionne
              hors-ligne.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                const accepted = await promptState.prompt();
                if (accepted) {
                  toast.success("TAP installé sur ton écran d'accueil.");
                } else {
                  await dismiss();
                }
              }}
              className="h-12 mt-4"
            >
              Installer l&apos;app
            </Button>
          </div>
        </>
      ) : (
        <>
          <Share2
            aria-hidden
            className="h-20 w-20 shrink-0 text-primary mt-2"
          />
          <div className="flex-1 space-y-8">
            <p className="text-sm font-medium text-foreground">
              Ajoute TAP à ton écran d&apos;accueil
            </p>
            <p className="text-xs text-muted-foreground">
              Touche{' '}
              <Share2
                aria-hidden
                className="inline h-14 w-14 align-text-bottom mx-2"
              />{' '}
              en bas de Safari, puis{' '}
              <Plus
                aria-hidden
                className="inline h-14 w-14 align-text-bottom mx-2"
              />{' '}
              <strong>Sur l&apos;écran d&apos;accueil</strong>.
            </p>
          </div>
        </>
      )}
      <button
        type="button"
        onClick={dismiss}
        aria-label="Masquer pendant 7 jours"
        className="shrink-0 rounded-md p-8 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X aria-hidden className="h-16 w-16 text-muted-foreground" />
      </button>
    </div>
  );
}
