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

// --------------------------------------------------------------------------
// Notifications push (DEC-167) — AJOUTÉES au SW Serwist existant (precache /
// offline INCHANGÉS). Affiche la notification reçue et ouvre l'app sur la
// course concernée au clic.
// --------------------------------------------------------------------------

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {};
  try {
    payload = (event.data?.json() as PushPayload | undefined) ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }
  const title = payload.title ?? 'TAP Réunion';
  const url = payload.url ?? '/conduite';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body ?? '',
      icon: '/icons/icon-192-any.png',
      badge: '/icons/icon-192-any.png',
      data: { url },
    }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | undefined;
  const url = data?.url ?? '/conduite';
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        await client.focus();
        if ('navigate' in client) await client.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
