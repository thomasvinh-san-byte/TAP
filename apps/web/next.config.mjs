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
  // D-07 Phase 06.9 : `typedRoutes` est stable en Next 15.5 et a quitté
  // `experimental`. Active la génération de types de routes ; si friction
  // de build sur des href dynamiques non typés, repasser à false.
  typedRoutes: true,
  transpilePackages: ['@tap/database', '@tap/shared'],
  // D-08 Phase 06.9 : Next 15 supporte la flat config ESLint 9, mais on
  // garde `ignoreDuringBuilds: true` pour ne pas faire échouer Vercel sur
  // des warnings hors périmètre. Le lint reste assuré par le job CI dédié
  // (`pnpm lint`). Réactivation ciblée laissée à une phase nettoyage CI.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // D-06 Phase 06.9 : le rewrite `/api/solver/*` → FastAPI port 8000 est
  // supprimé. Le microservice Python a été retiré en Phase 06.12 (ADR-010)
  // au profit de l'heuristique TS native `solveLocal`. Plus aucun caller
  // ne route vers `/api/solver`.
};

export default withSerwist(nextConfig);
