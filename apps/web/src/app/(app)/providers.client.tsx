'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/**
 * Providers globaux pour les composants client : TanStack Query.
 * Instancié une fois par useState pour éviter les re-créations à chaque render.
 *
 * NB : Toaster Sonner est désormais monté au layout racine
 * (`apps/web/src/app/layout.tsx`, PLAN-4 §4.3) pour couvrir aussi les
 * routes (auth)/(driver). Ne pas le re-monter ici (duplication).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
