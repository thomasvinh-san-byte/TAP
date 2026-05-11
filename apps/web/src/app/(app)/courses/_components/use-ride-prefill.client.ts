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
  apply: (next: F, patientLabel: string) => void,
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
        const label = r.patient ? `${r.patient.prenom} ${r.patient.nom}` : '';
        apply(buildForm(r as PrefillRide), label);
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
  patient?: { prenom: string; nom: string } | null;
};
