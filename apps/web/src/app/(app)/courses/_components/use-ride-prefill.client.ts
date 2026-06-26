'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { getRideByIdAction } from '../actions';

/**
 * Pré-remplit le RideExpressModal en mode édition (clôture Passe 1).
 *
 * Une seule lecture au mount — les modifications ultérieures viennent de
 * l'utilisateur. Si la course est introuvable (RLS bloque ou suppression
 * concurrente), on ferme proprement avec un toast d'erreur FR.
 *
 * Extrait du modal pour respecter la limite ≤ 300 lignes (CLAUDE.md § 11).
 */
export function useRidePrefill<F>(
  rideId: string | undefined,
  apply: (next: F, patientLabel: string, orderingPartyLabel: string) => void,
  onMissing: () => void,
  buildForm: (r: PrefillRide) => F,
): void {
  useEffect(() => {
    if (!rideId) return;
    let cancelled = false;
    void getRideByIdAction(rideId)
      .then((r) => {
        if (cancelled || !r) {
          if (!cancelled) {
            toast.error('Course introuvable.');
            onMissing();
          }
          return;
        }
        const ride = r as PrefillRide;
        const label = ride.patient ? `${ride.patient.prenom} ${ride.patient.nom}` : '';
        const orderingPartyLabel = ride.ordering_party?.raison_sociale ?? '';
        apply(buildForm(ride), label, orderingPartyLabel);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error('Course introuvable.');
        onMissing();
      });
    return () => {
      cancelled = true;
    };
    // apply / onMissing / buildForm sont stables par contrat ; le rideId
    // pilote seul l'effet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rideId]);
}

export type PrefillRide = {
  patient_id: string;
  scheduled_at: string;
  pickup_address: string;
  dropoff_address: string;
  transport_mode: string;
  urgency: string;
  notes_regulateur: string | null;
  ordering_party_id?: string | null;
  accompagnant?: boolean | null;
  accompagnant_payant?: boolean | null;
  accompagnant_identite?: string | null;
  patient?: { prenom: string; nom: string } | null;
  ordering_party?: { id: string; raison_sociale: string } | null;
};
