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
};

export default withSerwist(nextConfig);
