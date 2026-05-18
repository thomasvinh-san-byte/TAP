'use client';

import { useServiceWorkerRegister } from '@/lib/offline/sw-register.client';
import { useNetworkListener } from '@/lib/offline/network-listener.client';

/**
 * Composant mount-only — registre SW (Wave 3) + listener online pour
 * flush queue auto (Wave 4).
 *
 * Pas de render visible (return null). Intégré driver/layout.tsx pour
 * mount universel sur toutes les routes /conduite/*.
 *
 * Refs : PLAN-3, PLAN-4, DEC-022.
 */
export function SWRegister(): null {
  useServiceWorkerRegister();
  useNetworkListener();
  return null;
}
