/**
 * Phase 06.20 (DEC-097) — Sentry init **edge** (Edge runtime middleware).
 *
 * Capture des erreurs middleware Next 15 + Route Handlers `runtime='edge'`.
 * Scrubbing `beforeSend` partagé.
 *
 * No-op si DSN absent.
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
