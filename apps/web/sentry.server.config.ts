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

const DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === 'production',
    sendDefaultPii: false,
    tracesSampleRate: process.env.VERCEL_ENV === 'production' ? 0.1 : 1.0,
    beforeSend: sentryBeforeSend,
  });
}
