/**
 * Environnement applicatif, découplé de l'hébergeur (OVH-02).
 *
 * Source unique de la résolution d'environnement (utilisée par la config
 * Sentry). Repli sur `VERCEL_ENV` puis `NODE_ENV` pour préserver EXACTEMENT le
 * comportement actuel tant que `APP_ENV` n'est pas posé (cas Vercel). Sur OVH,
 * il suffira de poser `APP_ENV` (+ `NEXT_PUBLIC_APP_ENV` pour le client) sans
 * toucher au code.
 *
 * NB Next : les `process.env.NEXT_PUBLIC_*` ne sont inlinés au build que s'ils
 * sont référencés LITTÉRALEMENT — d'où les accès en toutes lettres ci-dessous
 * (ne jamais les construire dynamiquement).
 */

/** Environnement applicatif côté serveur / edge. */
export function getAppEnv(): string {
  return process.env.APP_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
}

/** Environnement applicatif côté client (navigateur) — variables NEXT_PUBLIC_ uniquement. */
export function getClientAppEnv(): string {
  return (
    process.env.NEXT_PUBLIC_APP_ENV ??
    process.env.NEXT_PUBLIC_VERCEL_ENV ??
    process.env.NODE_ENV ??
    'development'
  );
}

/** Vrai en production côté serveur / edge (pilote le tracesSampleRate Sentry). */
export function isProdAppEnv(): boolean {
  return getAppEnv() === 'production';
}

/** Vrai en production côté client (pilote le tracesSampleRate Sentry client). */
export function isProdClientAppEnv(): boolean {
  return getClientAppEnv() === 'production';
}
