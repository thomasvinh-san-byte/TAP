'use client';

import { useEffect } from 'react';

/**
 * Définition d'un raccourci clavier global (Phase 2 / Wave 3 — saisie express).
 *
 * IMPORTANT (RESEARCH §C1, §R1) : `Cmd+N` / `Ctrl+N` sont réservés navigateur
 * et NON-INTERCEPTABLES (Chrome/Firefox/Safari). Phase 2 utilise donc
 * `Cmd/Ctrl+Shift+K` (pattern Slack/Linear). DEC-015 mentionnait Cmd+N —
 * amendement assumé dans le scope de discrétion délégué (CONTEXT.md
 * §Claude's Discretion + §Open Questions).
 */
export interface ShortcutDef {
  /** true → metaKey OU ctrlKey requis (cross-platform Mac/Win) */
  mod: boolean;
  /** true → shiftKey requis ; false (default) → shiftKey ne doit PAS être pressé */
  shift?: boolean;
  /** Touche en minuscule (ex: 'k', 'n') — comparée à e.key.toLowerCase() */
  key: string;
}

/**
 * Enregistre un listener `keydown` global qui appelle `cb` quand `def` matche.
 * Cleanup automatique au démontage du composant qui appelle le hook.
 *
 * Garde-fou : `e.preventDefault()` n'est appelé que SI le raccourci matche
 * — ne casse jamais d'autres raccourcis (a11y, navigation native, etc.).
 *
 * Exigence de stabilité : passer `cb` via `useCallback` côté appelant pour
 * éviter ré-attachement listener à chaque render (RESEARCH C1).
 */
export function useGlobalShortcut(def: ShortcutDef, cb: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const modOk = def.mod ? e.metaKey || e.ctrlKey : true;
      const shiftRequired = def.shift === true;
      const shiftOk = shiftRequired ? e.shiftKey : !e.shiftKey;
      if (modOk && shiftOk && e.key.toLowerCase() === def.key) {
        e.preventDefault();
        cb();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [def.mod, def.shift, def.key, cb]);
}
