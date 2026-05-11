'use client';

import { createContext, useContext } from 'react';

/**
 * Entrée du store multi-instance saisie express (Phase 2 / Wave 3).
 *
 * - `tempKey` : identifiant local (UUID v4 généré côté client) pour
 *   réconcilier les modaux montés tant que le brouillon n'a pas encore
 *   d'`id` DB (le 1er upsertRideDraft renvoie l'id, qu'on stocke ici).
 * - `draftId` : id DB du brouillon (renseigné après le 1er upsert).
 * - `patientId` : raccourci pour pré-remplir un modal repris depuis la
 *   DraftQueue (Wave 4) sans devoir relire le payload.
 * - `minimized` : true → modal pas affiché à l'écran, accessible via
 *   la DraftQueue header (Wave 4).
 */
export interface DraftEntry {
  tempKey: string;
  draftId?: string;
  patientId?: string;
  minimized: boolean;
}

/**
 * Actions du reducer multi-instance (RESEARCH §C4).
 * - OPEN_NEW : Cmd+Shift+K ou bouton « + Nouvelle course » header. Champ
 *   optionnel `patientId` (03-G) pour ouvrir avec un patient déjà
 *   pré-sélectionné depuis le drawer patient — la modal reçoit la valeur
 *   via la prop `initialPatientId`.
 * - RESUME : click sur un brouillon dans la DraftQueue (Wave 4).
 * - CLOSE : modal fermé après création réussie OU bouton X.
 * - MINIMIZE : modal mis en pause (bouton « Mettre en pause »).
 * - SET_DRAFT_ID : renseigne `draftId` après le 1er upsertRideDraft.
 */
export type DraftAction =
  | { type: 'OPEN_NEW'; patientId?: string }
  | { type: 'CLOSE'; tempKey: string }
  | { type: 'RESUME'; draftId: string; patientId?: string }
  | { type: 'MINIMIZE'; tempKey: string }
  | { type: 'SET_DRAFT_ID'; tempKey: string; draftId: string };

export interface RideOrchestratorCtx {
  drafts: DraftEntry[];
  dispatch: (a: DraftAction) => void;
}

const Ctx = createContext<RideOrchestratorCtx | null>(null);

/** Provider du Context — utilisé exclusivement par RideExpressOrchestrator. */
export const RideOrchestratorProvider = Ctx.Provider;

/**
 * Hook consommateur — utilisé par le bouton header « + Nouvelle course » et
 * la DraftQueue (Wave 4). Throw si appelé hors du Provider pour éviter un
 * comportement silencieux dégradé (CLAUDE.md § 5 : pas d'erreur muette).
 */
export function useRideOrchestrator(): RideOrchestratorCtx {
  const v = useContext(Ctx);
  if (!v) {
    throw new Error(
      'useRideOrchestrator doit être utilisé sous <RideExpressOrchestrator>.',
    );
  }
  return v;
}
