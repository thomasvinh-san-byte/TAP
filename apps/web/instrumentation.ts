/**
 * Phase 06.20 (DEC-097) — Sentry register + onRequestError.
 *
 * Next 15 : ce fichier est appelé une fois par worker au démarrage du
 * runtime. On charge la bonne config selon `NEXT_RUNTIME`.
 *
 * `onRequestError` capte les erreurs des Server Components, Server
 * Actions et Route Handlers — sans ce hook explicite, Next 15 émet un
 * warning au build et ces erreurs ne remontent pas à Sentry.
 */

import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
