import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
      include: ['src/**/*.ts'],
      // Adapters `server-only` exclus : wrappers fournisseur (Twilio / souverain)
      // + dispatcher, testables seulement en intégration manuelle (compte
      // fournisseur), pas en unitaire dans l'environnement node de vitest.
      // sms-types = types purs (aucun code exécutable). OVH-03.
      exclude: [
        'src/index.ts',
        'src/**/__tests__/**',
        'src/twilio-adapter.ts',
        'src/sms-adapter.ts',
        'src/sovereign-adapter.ts',
        'src/sms-types.ts',
      ],
    },
  },
});
