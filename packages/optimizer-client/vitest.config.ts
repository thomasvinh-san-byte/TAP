import { defineConfig } from 'vitest/config';

// Seuils de couverture intentionnellement absents (CLAUDE.md §9) :
// 100 % est réservé à packages/pricing et packages/recurrence.
// Ce package a une cible raisonnable couverte par les tests de contract, client et transform.
export default defineConfig({
  test: {
    environment: 'node',
    env: {
      TZ: 'Indian/Reunion',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/__tests__/**'],
    },
  },
});
