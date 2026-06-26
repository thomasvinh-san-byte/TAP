'use client';

import { useQuery } from '@tanstack/react-query';
import { getPatientReferentStatusAction } from '../../patients/actions';

/**
 * Avertissement « référent légal obligatoire pour un mineur » (DEC-172, T3,
 * CdG l.139-140). Pattern miroir du bon expiré (07.06) : dérivé d'une requête,
 * VISIBLE mais NON bloquant (le régulateur garde la main). Le statut mineur est
 * dérivé serveur de date_naissance ; l'avertissement n'apparaît que si le
 * patient est mineur ET sans référent renseigné.
 */
export function MinorReferentWarning({ patientId }: { patientId?: string }): JSX.Element | null {
  const query = useQuery({
    queryKey: ['patient-referent-status', patientId],
    queryFn: () => getPatientReferentStatusAction(patientId as string),
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });

  const status = query.data;
  if (!status || !status.isMinor || status.hasReferent) return null;

  return (
    <p className="text-warning text-xs" role="alert">
      Patient mineur : contact référent légal (parent / tuteur) obligatoire. Renseignez-le dans la
      fiche patient.
    </p>
  );
}
