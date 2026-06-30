import { toIsoDate } from '@tap/recurrence';

/**
 * Cœur d'idempotence de la génération anticipée (RECURRENCE-01, §5.9).
 *
 * Parmi les occurrences générées, ne garde que celles à matérialiser :
 *   - FUTURES (>= maintenant) : on ne (re)génère jamais le passé ;
 *   - NON déjà matérialisées : la date (clé UTC `toIsoDate`) n'est pas dans
 *     l'ensemble des occurrences déjà présentes en base.
 *
 * Pur et testable : deux exécutions consécutives du cron, la 2e voyant les
 * dates créées par la 1re dans `existingDates`, retournent un résultat vide
 * (aucun doublon). Les dates exclues (table d'exceptions) sont déjà filtrées
 * en amont par `generateOccurrences(excludedDates)`.
 */
export function selectMissingOccurrences(
  occurrences: ReadonlyArray<Date>,
  existingDates: ReadonlySet<string>,
  nowMs: number,
): Date[] {
  return occurrences.filter((occ) => occ.getTime() >= nowMs && !existingDates.has(toIsoDate(occ)));
}
