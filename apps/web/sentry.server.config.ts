/**
 * Phase 06.20 (DEC-097) — Sentry init **server** (Node runtime).
 *
 * Capte les erreurs des Route Handlers, Server Actions, RSC server,
 * middleware. Scrubbing `beforeSend` partagé.
 *
 * No-op si `SENTRY_DSN` ou `NEXT_PUBLIC_SENTRY_DSN` absent.
 */

import * as Sentry from '@sentry/nextjs';
import { sentryBeforeSend } from '@/lib/sentry/scrub';
import { getAppEnv, isProdAppEnv } from '@/lib/app-env';

const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    // OVH-02 : environnement découplé de l'hébergeur (repli VERCEL_ENV → NODE_ENV).
    environment: getAppEnv(),
    enabled: process.env.NODE_ENV === 'production',
    sendDefaultPii: false,
    tracesSampleRate: isProdAppEnv() ? 0.1 : 1.0,
    beforeSend: sentryBeforeSend,
  });
}
