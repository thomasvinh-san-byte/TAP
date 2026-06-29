'use client';

import { useCallback, useState } from 'react';
import { checkRecurrenceSuggestionAction, type RecurrenceMatch } from '../actions';

/**
 * Hook EXPRESS-02 — suggestion de récurrence NON bloquante (CdG §5.8). Frère de
 * `useDuplicateCheck`. Déclenché quand patient + créneau sont renseignés ;
 * expose `suggestions` (récurrences qui tombent ce jour-là) + `runCheck`/`reset`.
 * N'empêche JAMAIS la création — purement informatif.
 */
export function useRecurrenceSuggestion() {
  const [suggestions, setSuggestions] = useState<RecurrenceMatch[]>([]);

  const runCheck = useCallback(async (patientId?: string, scheduledAt?: string): Promise<void> => {
    if (!patientId || !scheduledAt) {
      setSuggestions([]);
      return;
    }
    const res = await checkRecurrenceSuggestionAction({ patientId, scheduledAt });
    setSuggestions(res.data ?? []);
  }, []);

  const reset = useCallback(() => setSuggestions([]), []);

  return { suggestions, runCheck, reset };
}
