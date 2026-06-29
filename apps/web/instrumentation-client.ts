/**
 * Phase 06.20 (DEC-097) — Sentry init **client** (browser + RSC client).
 *
 * CONTRAINTE CRITIQUE — données de santé (RGPD) :
 *   - `sendDefaultPii: false` (NE PAS activer).
 *   - Session Replay DÉSACTIVÉ par défaut. Si réactivé un jour :
 *     `maskAllText: true` + `blockAllMedia: true` + onErrorSampleRate
 *     très bas.
 *   - Scrubbing `beforeSend` partagé via `sentryScrub`.
 *
 * Init **no-op si DSN absent** : dev local sans Sentry doit fonctionner.
 */

import * as Sentry from '@sentry/nextjs';
import { sentryBeforeSend } from '@/lib/sentry/scrub';
import { getClientAppEnv, isProdClientAppEnv } from '@/lib/app-env';

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // OVH-02 : environnement client découplé de l'hébergeur (repli NEXT_PUBLIC_VERCEL_ENV → NODE_ENV).
    environment: getClientAppEnv(),
    enabled: process.env.NODE_ENV === 'production',
    sendDefaultPii: false,
    // Sampling : 100% en preview, 10% en prod (cf. DSN par env).
    tracesSampleRate: isProdClientAppEnv() ? 0.1 : 1.0,
    // Replay laissé OFF par défaut (cf. PII santé). Pour activer un jour :
    // integrations: [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })],
    integrations: [],
    beforeSend: sentryBeforeSend,
    beforeBreadcrumb: (breadcrumb) => {
      // Ne pas remonter les breadcrumbs de requêtes contenant des données
      // patient (PII URL params, body).
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        // Retire la query string par prudence (peut contenir un patient_id).
        if (breadcrumb.data?.url && typeof breadcrumb.data.url === 'string') {
          breadcrumb.data.url = breadcrumb.data.url.split('?')[0];
        }
      }
      return breadcrumb;
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
