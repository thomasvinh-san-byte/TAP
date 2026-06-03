import { defineConfig } from 'vitest/config';
import path from 'node:path';

/**
 * Vitest config — apps/web (Phase 06.11 Wave 3).
 *
 * Convention monorepo : versions alignées sur packages/shared, pricing,
 * recurrence, optimizer-client (toutes en vitest ^2.1.9).
 *
 * Stratégie d'environnement :
 *   - `.test.ts`  → env node (logique pure, ex: sla-status, group-colors).
 *   - `.test.tsx` → env jsdom (rendu composants React, ex: ride-badge).
 *   Réalisé via `environmentMatchGlobs`. Évite de charger jsdom pour les
 *   tests purs (coût startup ~200 ms).
 *
 * TZ alignée sur packages/shared : `Indian/Reunion` — cohérence avec
 * Playwright (timezoneId) et runtime navigateur régulatrice.
 *
 * Exclusions : les tests Playwright (`tests/`, `e2e/`) sont scannés
 * séparément par `test:e2e`. On les sort du scope Vitest pour éviter
 * les faux « 0 test » bruyants.
 */
export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist', '.next', 'tests/**', 'e2e/**'],
    environmentMatchGlobs: [
      ['**/*.test.tsx', 'jsdom'],
      ['**/*.test.ts', 'node'],
    ],
    env: {
      TZ: 'Indian/Reunion',
    },
    setupFiles: ['./vitest.setup.ts'],
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
