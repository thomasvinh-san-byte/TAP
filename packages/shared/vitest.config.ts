import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Aligné sur apps/web/playwright.config.ts (timezoneId: 'Indian/Reunion').
    // Garantit que les helpers date-fns / format-date-fr produisent des ISO
    // stables identiques au runtime navigateur de la régulatrice
    // (cf. RESEARCH § Pitfall 5 — TZ-aware tests).
    env: {
      TZ: 'Indian/Reunion',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});
