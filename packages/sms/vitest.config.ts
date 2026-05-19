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
      // twilio-adapter exclu : wrapper externe pur (test integration manuel
      // avec compte Twilio sandbox uniquement).
      exclude: ['src/index.ts', 'src/**/__tests__/**', 'src/twilio-adapter.ts'],
    },
  },
});
