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
};

export default withSerwist(nextConfig);
