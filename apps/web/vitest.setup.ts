/**
 * Setup vitest — apps/web (Phase 06.11 Wave 3).
 *
 * Étend les matchers Vitest avec ceux de @testing-library/jest-dom
 * (`toBeInTheDocument`, `toHaveClass`, etc.) uniquement quand l'env
 * est jsdom (tests .tsx). En env node (tests .ts), l'import est
 * inerte — `document` n'est pas requis.
 *
 * Cleanup automatique entre tests : @testing-library/react auto-cleanup
 * via `afterEach` ne fonctionne qu'avec `globals: true`. On l'inscrit
 * explicitement pour rester avec `globals: false` (préférence repo).
 */
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

afterEach(() => {
  cleanup();
});
