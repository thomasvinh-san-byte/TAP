'use client';

import { useServiceWorkerRegister } from '@/lib/offline/sw-register.client';

/**
 * Composant mount-only — register SW + storage.persist() + lastUsedAt.
 *
 * Pas de render visible (return null). Intégré dans driver/layout.tsx
 * pour mount universel sur toutes les routes /conduite/*.
 *
 * Refs : PLAN-3, DEC-022.
 */
export function SWRegister(): null {
  useServiceWorkerRegister();
  return null;
}
