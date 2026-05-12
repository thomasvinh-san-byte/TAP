'use server';

/**
 * Server Action `getPatientRideDefaultsAction` — Plan 03.1-01 (A2 smart defaults).
 *
 * Pattern (CLAUDE.md § 10) : Validation zod → Authz (getAuthContext +
 * whitelist rôle applicative) → Lecture déléguée à `queries.ts` →
 * reformulation FR systématique sur erreur.
 *
 * Décisions locked (cf. 03.1-CONTEXT.md) :
 *  - D-A2-1 : silent prefill — le hook appelant ignore les erreurs, pas de toast.
 *  - D-A2-3 : action self-contained dans le barrel `patients/actions/`
 *    (Option A checker B2), re-exportée via `./index.ts`.
 */

import { z } from 'zod';
import { getAuthContext } from '@/lib/auth/get-auth-context';
import { REGULATEUR_OR_DIRIGEANT } from '@/app/(app)/courses/actions/_shared';
import { getPatientRideDefaults } from '../queries';

const schema = z.object({ patientId: z.string().uuid() });

export type PatientRideDefaultsState = {
  data?: { transport_mode: string; urgency: string } | null;
  error?: string;
};

export async function getPatientRideDefaultsAction(
  patientId: string,
): Promise<PatientRideDefaultsState> {
  const parsed = schema.safeParse({ patientId });
  if (!parsed.success) {
    return { error: 'Identifiant patient invalide.' };
  }
  try {
    const ctx = await getAuthContext();
    if (!ctx) return { error: 'Session expirée. Reconnectez-vous.' };
    if (!REGULATEUR_OR_DIRIGEANT.includes(ctx.role as never)) {
      return { error: 'Accès non autorisé.' };
    }
    const data = await getPatientRideDefaults(
      parsed.data.patientId,
      ctx.organizationId,
    );
    return { data };
  } catch {
    return { error: 'Pré-remplissage indisponible.' };
  }
}
