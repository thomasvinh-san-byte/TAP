'use client';

import { useCallback, useReducer } from 'react';
import { useGlobalShortcut } from '@/lib/keyboard-shortcuts';
import { RideExpressModal } from './ride-express-modal.client';
import {
  RideOrchestratorProvider,
  type DraftAction,
  type DraftEntry,
} from './ride-orchestrator-context.client';

/**
 * Génère un identifiant temporaire stable pour un brouillon non encore persisté.
 * Fallback `Date.now() + Math.random()` si crypto.randomUUID() indisponible
 * (anciens navigateurs ou contexte non sécurisé).
 */
function generateTempKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Reducer pure du store multi-instance (RESEARCH §C4).
 *
 * Sémantique D-04 : ouvrir un nouveau modal alors qu'un autre est visible
 * => le visible est minimisé (auto-save côté modal child via flushSave avant
 * unmount logique). Le nouveau modal apparaît seul et autofocused.
 */
function draftsReducer(state: DraftEntry[], a: DraftAction): DraftEntry[] {
  switch (a.type) {
    case 'OPEN_NEW': {
      const minimized = state.map((d) =>
        d.minimized ? d : { ...d, minimized: true },
      );
      return [
        ...minimized,
        { tempKey: generateTempKey(), minimized: false },
      ];
    }
    case 'CLOSE':
      return state.filter((d) => d.tempKey !== a.tempKey);
    case 'MINIMIZE':
      return state.map((d) =>
        d.tempKey === a.tempKey ? { ...d, minimized: true } : d,
      );
    case 'RESUME': {
      const exists = state.find((d) => d.draftId === a.draftId);
      if (exists) {
        return state.map((d) =>
          d.draftId === a.draftId
            ? { ...d, minimized: false }
            : { ...d, minimized: true },
        );
      }
      const minimized = state.map((d) => ({ ...d, minimized: true }));
      return [
        ...minimized,
        {
          tempKey: generateTempKey(),
          draftId: a.draftId,
          patientId: a.patientId,
          minimized: false,
        },
      ];
    }
    case 'SET_DRAFT_ID':
      return state.map((d) =>
        d.tempKey === a.tempKey ? { ...d, draftId: a.draftId } : d,
      );
    default:
      return state;
  }
}

/**
 * Orchestrator multi-instance modale (Phase 2 / Wave 3).
 * Monté UNE fois dans `(app)/layout.tsx` (Wave 4) — écoute Cmd/Ctrl+Shift+K
 * et expose `dispatch` via Context (header bouton + DraftQueue Wave 4).
 *
 * Context minimal {drafts, dispatch} ciblé sur 2-3 consumers — overhead OK
 * (cf. CONTEXT.md §Claude's Discretion ; contraste RESEARCH §C4 qui parle
 * du store INTERNE non-partagé). Un seul modal visible à la fois.
 */
export function RideExpressOrchestrator({
  children,
}: {
  children?: React.ReactNode;
}): JSX.Element {
  const [drafts, dispatch] = useReducer(draftsReducer, []);
  const openNew = useCallback(() => dispatch({ type: 'OPEN_NEW' }), []);

  useGlobalShortcut({ mod: true, shift: true, key: 'k' }, openNew);

  const visible = drafts.find((d) => !d.minimized);

  return (
    <RideOrchestratorProvider value={{ drafts, dispatch }}>
      {children}
      {visible && (
        <RideExpressModal
          key={visible.tempKey}
          tempKey={visible.tempKey}
          draftId={visible.draftId}
          initialPatientId={visible.patientId}
          onClose={() =>
            dispatch({ type: 'CLOSE', tempKey: visible.tempKey })
          }
          onMinimize={() =>
            dispatch({ type: 'MINIMIZE', tempKey: visible.tempKey })
          }
          onDraftIdResolved={(id) =>
            dispatch({
              type: 'SET_DRAFT_ID',
              tempKey: visible.tempKey,
              draftId: id,
            })
          }
        />
      )}
    </RideOrchestratorProvider>
  );
}
