import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Aligné sur apps/web/playwright.config.ts (timezoneId: 'Indian/Reunion').
    // Garantit que parse-freeform-date.test.ts produit des ISO stables
    // identiques au runtime navigateur de la régulatrice (cf. RESEARCH § Pitfall 5).
    env: {
      TZ: 'Indian/Reunion',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
