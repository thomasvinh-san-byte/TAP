'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * Hook fetch holidays_974 avec cache mémoire (Set<string> YYYY-MM-DD).
 *
 * Politique de fetch : 1 fois au mount. Les 36 rows seed couvrent
 * 2026-2028 (Phase 05 V1.5). Mise à jour annuelle Phase 06+.
 *
 * Renvoie Set vide pendant le fetch (l'UI affichera les occurrences
 * sans filtrage holiday — acceptable, le SSR refresh corrige).
 */
export function useHolidays974(): Set<string> {
  const [holidays, setHolidays] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    void (async () => {
      const result = await supabase.from('holidays_974').select('date');
      if (cancelled) return;
      if (result.error || !result.data) return;
      const rows = result.data as { date: string }[];
      setHolidays(new Set(rows.map((row) => row.date)));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return holidays;
}
