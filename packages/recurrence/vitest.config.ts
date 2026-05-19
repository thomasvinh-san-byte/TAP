import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      TZ: 'UTC',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/__tests__/**'],
    },
  },
});
