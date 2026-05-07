import * as chrono from 'chrono-node';

export type ParseFreeformDateResult =
  | { ok: true; iso: string }
  | { ok: false; reason: string };

/**
 * Parse une saisie libre type « 15/05 14h30 » / « demain 8h » / « lundi 9h »
 * vers une ISO 8601 (UTC). Locale FR via chrono.fr.
 *
 * Règle métier (DEC-005) : les dates dans le passé sont refusées
 * (la régulatrice ne saisit jamais une course rétroactive Phase 2).
 *
 * IMPORTANT : appelée UNIQUEMENT côté client (TZ navigateur =
 * Indian/Reunion pour la régulatrice — voir RESEARCH § Pitfall 5).
 * Le serveur reçoit une ISO string déjà résolue.
 *
 * @param input  Saisie libre de la régulatrice
 * @param ref    Date de référence (par défaut now). Permet de figer
 *               le contexte temporel pour les tests (vi.setSystemTime).
 */
export function parseFreeformDate(
  input: string,
  ref: Date = new Date(),
): ParseFreeformDateResult {
  if (!input || input.trim().length === 0) {
    return { ok: false, reason: 'Date requise' };
  }
  let parsed: Date | null = null;
  try {
    parsed = chrono.fr.parseDate(input, ref, { forwardDate: true });
  } catch {
    // chrono-node lève rarement, mais on protège la régulatrice contre une
    // entrée pathologique (T-02-03 STRIDE — voir threat_model du PLAN).
    parsed = null;
  }
  if (!parsed) {
    return {
      ok: false,
      reason:
        'Format non reconnu — exemples : 15/05 14h30, demain 8h, lundi 9h',
    };
  }
  if (parsed.getTime() < ref.getTime()) {
    return { ok: false, reason: 'Date dans le passé' };
  }
  return { ok: true, iso: parsed.toISOString() };
}
