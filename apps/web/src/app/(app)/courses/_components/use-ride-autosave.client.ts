'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { upsertRideDraft } from '../actions';

/**
 * Auto-save D-05 du modal saisie express — extrait du composant principal
 * pour respecter CLAUDE.md § 11 (≤ 300 L par fichier).
 *
 * Désactivé en mode édition (`isEditMode`) : on ne crée pas de brouillon
 * sur une course existante.
 */
type SavingState = 'idle' | 'saving' | 'saved' | 'error';

type AutosavePayloadBase = {
  patient_id?: string;
  pickup_address?: string;
  dropoff_address?: string;
  scheduled_at?: string;
};

export function useRideAutosave<TForm extends AutosavePayloadBase>(args: {
  isEditMode: boolean;
  initialDraftId: string | undefined;
  onDraftIdResolved: (id: string) => void;
}) {
  const [savingState, setSavingState] = useState<SavingState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftIdRef = useRef<string | undefined>(args.initialDraftId);

  const flushSave = useCallback(
    async (payload: TForm): Promise<void> => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      if (args.isEditMode) return;
      if (
        !payload.patient_id &&
        !payload.pickup_address &&
        !payload.dropoff_address &&
        !payload.scheduled_at
      ) {
        return;
      }
      setSavingState('saving');
      const res = await upsertRideDraft({
        id: draftIdRef.current,
        payload,
        patient_id: payload.patient_id,
      });
      if ('error' in res) {
        setSavingState('error');
        toast.error('Sauvegarde impossible — réessai automatique');
        return;
      }
      if (!draftIdRef.current) {
        draftIdRef.current = res.id;
        args.onDraftIdResolved(res.id);
      }
      setSavingState('saved');
      setLastSavedAt(Date.now());
    },
    [args],
  );

  const scheduleSave = useCallback(
    (next: TForm) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => void flushSave(next), 5000);
    },
    [flushSave],
  );

  // Cleanup debounce on unmount (Pitfall 2)
  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  return { savingState, lastSavedAt, flushSave, scheduleSave, draftIdRef };
}
