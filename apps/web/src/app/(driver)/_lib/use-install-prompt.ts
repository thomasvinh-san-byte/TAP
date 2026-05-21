'use client';

/**
 * Hook `useInstallPrompt` — Phase 04.9 post-clôture mini-PR #118.
 *
 * Détecte 4 états PWA install cross-platform Option A LOCKED :
 *   1. standalone : déjà installée (Android matchMedia ou iOS
 *      navigator.standalone) → banner null
 *   2. android-ready : Chromium-based + beforeinstallprompt event
 *      capturé → bouton « Installer » déclenche prompt() natif
 *   3. ios-safari : iOS Safari (pas Chrome iOS) → instructions
 *      visuelles « Partager → Ajouter à l'écran d'accueil »
 *   4. unsupported : autre browser (Firefox iOS, desktop) → null
 *
 * Pattern industry 2026 confirmé :
 *   - web.dev/learn/pwa/installation-prompt
 *   - MDN Trigger installation PWA
 *   - mobiloud.com 2026 : custom banners required for iOS
 *   - junkangworld 2025 : visual cues + Share icon instructions
 *
 * Remplace `useIsStandalone` Wave 5 (item #7 CONCERNS résolu, hook
 * conservé pour rétro-compat Phase 05/06).
 *
 * Refs : PLAN-5 Phase 04.9, Option A cross-platform LOCKED PR #109.
 */

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export type InstallPromptState =
  | { kind: 'standalone' }
  | { kind: 'unsupported' }
  | { kind: 'ios-safari' }
  | { kind: 'android-ready'; prompt: () => Promise<boolean> };

export function useInstallPrompt(): InstallPromptState {
  const [state, setState] = useState<InstallPromptState>({
    kind: 'unsupported',
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandaloneMatch = window.matchMedia('(display-mode: standalone)').matches;
    const isIosStandalone =
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (isStandaloneMatch || isIosStandalone) {
      setState({ kind: 'standalone' });
      return;
    }

    // iOS Safari (Chrome iOS n'a pas la prop standalone). UA sniffing
    // toléré ici (Apple Web standard détection).
    const ua = window.navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) && !('MSStream' in window);
    const isIosSafari =
      isIos && (window.navigator as Navigator & { standalone?: boolean }).standalone === false;
    if (isIosSafari) {
      setState({ kind: 'ios-safari' });
      return;
    }

    let deferredPrompt: BeforeInstallPromptEvent | null = null;
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setState({
        kind: 'android-ready',
        prompt: async () => {
          if (!deferredPrompt) return false;
          await deferredPrompt.prompt();
          const result = await deferredPrompt.userChoice;
          deferredPrompt = null;
          return result.outcome === 'accepted';
        },
      });
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Passer state standalone après install Android Chrome (sans reload)
    const installedHandler = () => setState({ kind: 'standalone' });
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  return state;
}
