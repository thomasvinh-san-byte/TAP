'use client';

import { useCallback, useReducer } from 'react';
import type { OptimizationProposal, Groupement, ExcludedRide } from '@tap/optimizer-client';

export type GroupDecision = 'idle' | 'accepted' | 'rejected';

export type AdjustedGroupement = {
  groupementId: string;
  rideIds: string[];
  vehicleId: string;
};

export type OptimizationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'result'; proposal: OptimizationProposal }
  | { status: 'empty'; excludedRides: ExcludedRide[] }
  | { status: 'error'; message: string };

type Action =
  | { type: 'LAUNCH' }
  | { type: 'SUCCESS'; proposal: OptimizationProposal }
  | { type: 'EMPTY'; excludedRides: ExcludedRide[] }
  | { type: 'ERROR'; message: string }
  | { type: 'ACCEPT'; id: string }
  | { type: 'REJECT'; id: string }
  | { type: 'ADJUST'; id: string; adjusted: AdjustedGroupement }
  | { type: 'SET_DRIVER'; id: string; driverId: string | null };

type State = {
  optimization: OptimizationState;
  decisions: Map<string, GroupDecision>;
  adjustments: Map<string, AdjustedGroupement>;
  // Chauffeur choisi par groupement (clé = vehicle_id). Initialisé depuis la
  // suggestion du Route Handler, modifiable par le régulateur (validation humaine).
  driverByGroupement: Map<string, string | null>;
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'LAUNCH':
      return {
        ...state,
        optimization: { status: 'loading' },
        decisions: new Map(),
        adjustments: new Map(),
        driverByGroupement: new Map(),
      };
    case 'SUCCESS': {
      // Amorce le choix de chauffeur avec la suggestion déterministe du serveur.
      const suggested = action.proposal.suggestedDriverByGroupement ?? {};
      const driverByGroupement = new Map<string, string | null>(
        action.proposal.groupements.map((g) => [g.vehicle_id, suggested[g.vehicle_id] ?? null]),
      );
      return {
        ...state,
        optimization: { status: 'result', proposal: action.proposal },
        driverByGroupement,
      };
    }
    case 'EMPTY':
      return {
        ...state,
        optimization: { status: 'empty', excludedRides: action.excludedRides },
      };
    case 'ERROR':
      return { ...state, optimization: { status: 'error', message: action.message } };
    case 'ACCEPT': {
      const d = new Map(state.decisions);
      d.set(action.id, 'accepted');
      return { ...state, decisions: d };
    }
    case 'REJECT': {
      const d = new Map(state.decisions);
      d.set(action.id, 'rejected');
      return { ...state, decisions: d };
    }
    case 'ADJUST': {
      const d = new Map(state.decisions);
      const adj = new Map(state.adjustments);
      d.set(action.id, 'accepted');
      adj.set(action.id, action.adjusted);
      return { ...state, decisions: d, adjustments: adj };
    }
    case 'SET_DRIVER': {
      const dbg = new Map(state.driverByGroupement);
      dbg.set(action.id, action.driverId);
      return { ...state, driverByGroupement: dbg };
    }
    default:
      return state;
  }
}

const INITIAL_STATE: State = {
  optimization: { status: 'idle' },
  decisions: new Map(),
  adjustments: new Map(),
  driverByGroupement: new Map(),
};

const ERROR_MSG =
  "Le service d'optimisation n'est pas disponible pour le moment. Les tournées ne sont pas affectées. Réessayez dans quelques minutes.";

export function useOptimization(date: string) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const launch = useCallback(async () => {
    dispatch({ type: 'LAUNCH' });
    try {
      const res = await fetch('/api/optimizer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      if (!res.ok) {
        dispatch({ type: 'ERROR', message: ERROR_MSG });
        return;
      }
      const proposal = (await res.json()) as OptimizationProposal;
      if (proposal.groupements.length === 0 && proposal.ridesNonGroupeesIds.length === 0) {
        dispatch({ type: 'EMPTY', excludedRides: proposal.excludedRides });
      } else {
        dispatch({ type: 'SUCCESS', proposal });
      }
    } catch {
      dispatch({ type: 'ERROR', message: ERROR_MSG });
    }
  }, [date]);

  const accept = useCallback((id: string) => dispatch({ type: 'ACCEPT', id }), []);
  const reject = useCallback((id: string) => dispatch({ type: 'REJECT', id }), []);
  const adjust = useCallback(
    (id: string, adjusted: AdjustedGroupement) => dispatch({ type: 'ADJUST', id, adjusted }),
    [],
  );
  const setDriver = useCallback(
    (id: string, driverId: string | null) => dispatch({ type: 'SET_DRIVER', id, driverId }),
    [],
  );

  const acceptedGroupements: Groupement[] =
    state.optimization.status === 'result'
      ? state.optimization.proposal.groupements.filter(
          (g) => state.decisions.get(g.vehicle_id) === 'accepted',
        )
      : [];

  return {
    state: state.optimization,
    decisions: state.decisions,
    adjustments: state.adjustments,
    driverByGroupement: state.driverByGroupement,
    launch,
    accept,
    reject,
    adjust,
    setDriver,
    acceptedGroupements,
  };
}
