/// <reference lib="WebWorker" />
/**
 * Service Worker entry point — Phase 04.9 Wave 3 PWA chauffeur.
 *
 * Build via withSerwistInit (next.config.mjs) → public/sw.js.
 *
 * Stratégies cache :
 *   - /api/driver/* → NetworkOnly (mutations JAMAIS cachées, retry
 *     géré côté client via sync engine Wave 4)
 *   - Default → defaultCache Serwist (StaleWhileRevalidate pour
 *     navigation /conduite/* + CacheFirst pour /_next/static/*)
 *
 * Refs : PLAN-3, DEC-019.
 */

import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname.startsWith('/api/driver/'),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
