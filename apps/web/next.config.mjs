import withSerwistInit from '@serwist/next';

/**
 * Serwist wrapper — Phase 04.9 Wave 3 PWA chauffeur.
 *
 * - swSrc : entry point TS dans src/sw.ts
 * - swDest : output JS dans public/sw.js (servi en runtime)
 * - cacheOnNavigation : précache au premier mount /conduite
 * - reloadOnOnline: false : éviter reload pendant saisie chauffeur
 * - disable en dev : préserver HMR
 */
const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  reloadOnOnline: false,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  transpilePackages: ['@tap/database', '@tap/shared'],
  // Le lint est assuré par le job CI dédié (`eslint`, flat config ESLint 9 —
  // D1). Next 14 ne supporte pas la flat config à la compilation : on
  // désactive le lint intégré au build pour éviter un faux échec Vercel.
  eslint: {
    ignoreDuringBuilds: true,
  },
  /**
   * Rewrite `/api/solver/*` vers la fonction Python FastAPI.
   *
   * Next.js intercepte par défaut toutes les requêtes `/api/*` parce que ce
   * projet a 8 Route Handlers sous `app/api/*`. Sans ce rewrite, une requête
   * à `/api/solver/health` ne trouve aucun `app/api/solver/route.ts` et
   * tombe sur le 404 Next.js — Vercel n'a jamais l'occasion de router vers
   * la fonction Python déclarée dans `apps/web/vercel.json`.
   *
   * Pattern documenté dans `digitros/nextjs-fastapi` et
   * `vercel.com/kb/guide/how-to-use-python-and-javascript-in-the-same-application`.
   *
   * - En production : `destination` pointe vers `/py/solver/:path*` — le code
   *   Python est physiquement situé hors de `/api/` (apps/web/py/solver/, cf.
   *   Wave 1 Phase 06.10, ADR-009) pour éviter le conflit avec le routing
   *   Next.js. Vercel route les requêtes `/py/solver/*` vers la fonction
   *   Python déclarée dans `apps/web/vercel.json`.
   * - En développement : proxy vers FastAPI local sur le port 8000 si lancé
   *   en parallèle (`uvicorn` côté `apps/web/py/solver/`).
   */
  async rewrites() {
    return [
      {
        source: '/api/solver/:path*',
        destination:
          process.env.NODE_ENV === 'development'
            ? 'http://127.0.0.1:8000/api/solver/:path*'
            : '/py/solver/:path*',
      },
    ];
  },
};

export default withSerwist(nextConfig);
