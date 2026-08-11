'use client';

import * as React from 'react';

/**
 * Persistance des filtres de la liste des courses (statut / mode / urgence /
 * recherche) entre visites — même patron que `useTableDensity` : lecture /
 * écriture `localStorage`, initialisation dans un `useEffect` (pas de lecture au
 * rendu serveur → pas de mismatch d'hydratation), défauts sûrs, validation des
 * valeurs stockées.
 *
 * La DATE est volontairement EXCLUE : elle repart sur « aujourd'hui » à chaque
 * ouverture (retrouver une vieille date filtrée serait déroutant). Elle reste un
 * `useState` classique côté appelant.
 */

const STORAGE_KEY = 'courses-filters';

// Whitelists de validation (valeurs techniques uniquement — à garder en phase
// avec STATUS_FILTERS / MODE_FILTERS de rides-list). Une valeur stockée hors
// liste (corruption, statut retiré) est ignorée → repli sur le défaut.
const STATUS_VALUES = [
  'all',
  'validee',
  'assignee',
  'en_cours',
  'arrive_sur_place',
  'patient_a_bord',
  'terminee',
  'annulee_regulateur',
];
const MODE_VALUES = ['all', 'taxi_conventionne', 'tpmr', 'vsl', 'ambulance'];

export type UrgencyFilter = 'all' | 'urgent';

interface PersistedFilters {
  status: string;
  mode: string;
  urgency: UrgencyFilter;
  search: string;
}

const DEFAULTS: PersistedFilters = { status: 'all', mode: 'all', urgency: 'all', search: '' };

/** Nettoie une valeur brute (JSON) → filtres valides ; toute valeur illégale → défaut. */
function sanitize(raw: unknown): PersistedFilters {
  if (!raw || typeof raw !== 'object') return DEFAULTS;
  const o = raw as Record<string, unknown>;
  return {
    status: typeof o.status === 'string' && STATUS_VALUES.includes(o.status) ? o.status : 'all',
    mode: typeof o.mode === 'string' && MODE_VALUES.includes(o.mode) ? o.mode : 'all',
    urgency: o.urgency === 'urgent' ? 'urgent' : 'all',
    // Recherche : chaîne bornée (garde-fou taille) ; sinon vide.
    search: typeof o.search === 'string' ? o.search.slice(0, 100) : '',
  };
}

export function usePersistedCoursesFilters(): {
  status: string;
  setStatus: (v: string) => void;
  mode: string;
  setMode: (v: string) => void;
  urgency: UrgencyFilter;
  setUrgency: (v: UrgencyFilter) => void;
  search: string;
  setSearch: (v: string) => void;
} {
  const [status, setStatus] = React.useState<string>(DEFAULTS.status);
  const [mode, setMode] = React.useState<string>(DEFAULTS.mode);
  const [urgency, setUrgency] = React.useState<UrgencyFilter>(DEFAULTS.urgency);
  const [search, setSearch] = React.useState<string>(DEFAULTS.search);

  // Hydratation UNE fois, en effet (pas de lecture au rendu → pas de mismatch).
  React.useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage indisponible — pas de persistance. */
    }
    if (!stored) return;
    try {
      const f = sanitize(JSON.parse(stored));
      setStatus(f.status);
      setMode(f.mode);
      setUrgency(f.urgency);
      setSearch(f.search);
    } catch {
      /* JSON corrompu → on garde les défauts. */
    }
  }, []);

  // Persistance à chaque changement, en SAUTANT le tout premier commit — sinon on
  // écraserait la valeur stockée avec les défauts avant l'hydratation.
  const firstCommit = React.useRef(true);
  React.useEffect(() => {
    if (firstCommit.current) {
      firstCommit.current = false;
      return;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ status, mode, urgency, search }));
    } catch {
      /* localStorage indisponible — préférence non persistée. */
    }
  }, [status, mode, urgency, search]);

  return { status, setStatus, mode, setMode, urgency, setUrgency, search, setSearch };
}
