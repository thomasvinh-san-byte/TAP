'use client';

import * as React from 'react';

/**
 * Colonnes MASQUABLES de la liste des courses + persistance de leur visibilité.
 *
 * Source unique des colonnes masquables (clé + libellé) — utilisée par le menu
 * « Colonnes » ET pour marquer `hideable` sur les colonnes du tableau. Les
 * colonnes essentielles (heure / patient / trajet) n'y figurent pas → toujours
 * visibles.
 *
 * La persistance suit le patron des autres hooks (densité / filtres) :
 * localStorage, initialisation dans un effet (pas de lecture au rendu serveur →
 * pas de mismatch d'hydratation), défaut sûr (rien de masqué = tout visible),
 * validation des clés stockées (une clé inconnue → ignorée → colonne visible).
 */
export const COURSES_HIDEABLE_COLUMNS = [
  { key: 'mode', label: 'Mode' },
  { key: 'urgence', label: 'Urgence' },
  { key: 'chauffeur', label: 'Chauffeur' },
  { key: 'statut', label: 'Statut' },
  { key: 'paiement', label: 'Paiement' },
] as const;

const VALID_KEYS = new Set<string>(COURSES_HIDEABLE_COLUMNS.map((c) => c.key));
const STORAGE_KEY = 'courses-hidden-columns';

function persist(hidden: Set<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
  } catch {
    /* localStorage indisponible — préférence non persistée. */
  }
}

export function useCoursesHiddenColumns(): {
  hidden: Set<string>;
  toggle: (key: string) => void;
  reset: () => void;
} {
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());

  // Hydratation UNE fois, en effet. Toute clé inconnue (corruption, colonne
  // retirée) est ignorée → la colonne reste visible.
  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage indisponible. */
    }
    if (!stored) return;
    try {
      const arr = JSON.parse(stored);
      if (Array.isArray(arr)) {
        setHidden(
          new Set(arr.filter((k): k is string => typeof k === 'string' && VALID_KEYS.has(k))),
        );
      }
    } catch {
      /* JSON corrompu → tout visible (défaut). */
    }
  }, []);

  const toggle = React.useCallback((key: string) => {
    if (!VALID_KEYS.has(key)) return; // jamais masquer une colonne non masquable
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persist(next);
      return next;
    });
  }, []);

  const reset = React.useCallback(() => {
    const empty = new Set<string>();
    setHidden(empty);
    persist(empty);
  }, []);

  return { hidden, toggle, reset };
}
