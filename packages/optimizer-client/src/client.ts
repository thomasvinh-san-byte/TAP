/**
 * Client HTTP typé pour le service d'optimisation de tournées.
 * Isomorphe (pas de server-only) — utilisable depuis Vitest et depuis un Route Handler Next.js.
 */

import {
  SolveRequestSchema,
  SolveResponseSchema,
  type SolveRequest,
  type SolveResponse,
} from './contract';

/** Codes d'erreur typés du client solveur. */
export type OptimizerErrorCode = 'TIMEOUT' | 'UNAVAILABLE' | 'CONTRACT_MISMATCH' | 'VALIDATION';

/** Erreur typée levée par solve() pour chaque mode d'échec. */
export class OptimizerError extends Error {
  constructor(
    message: string,
    public readonly code: OptimizerErrorCode,
  ) {
    super(message);
    this.name = 'OptimizerError';
  }
}

/**
 * Appelle le service d'optimisation via HTTP.
 * Valide la requête avant envoi et la réponse à réception.
 * Lève OptimizerError pour tout mode d'échec (timeout, indisponibilité, dérive de contrat).
 *
 * @param request - Payload de résolution validé par SolveRequestSchema
 * @param options - URL de base du service et timeout en millisecondes
 */
export async function solve(
  request: SolveRequest,
  options: { baseUrl: string; timeoutMs: number },
): Promise<SolveResponse> {
  const parseResult = SolveRequestSchema.safeParse(request);
  if (!parseResult.success) {
    throw new OptimizerError('Paramètres de la requête invalides.', 'VALIDATION');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const res = await fetch(`${options.baseUrl}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parseResult.data),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new OptimizerError("Le service d'optimisation n'est pas disponible.", 'UNAVAILABLE');
    }

    const raw: unknown = await res.json();
    const parsed = SolveResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new OptimizerError(
        "Réponse du service d'optimisation inattendue.",
        'CONTRACT_MISMATCH',
      );
    }

    return parsed.data;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new OptimizerError("Le service d'optimisation a dépassé le délai imparti.", 'TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
