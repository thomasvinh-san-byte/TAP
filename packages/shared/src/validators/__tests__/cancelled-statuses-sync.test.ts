import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RIDE_CANCELLED_STATUSES } from '../ride';

/**
 * Garde-fou CI (DEC-176) — alignement de la SEULE liste de statuts annulés
 * dupliquée hors TypeScript : la constante `RIDE_CANCELLED_STATUSES`
 * (@tap/shared) et l'array `cancelled` du trigger Postgres de comptage des
 * trajets de prescription (`rides_prescription_counter`).
 *
 * Un trigger SQL ne peut pas importer une constante TS → le couplage était
 * MANUEL et a produit le bug B2 (12.05) : `annulee_meteo` ajouté côté app mais
 * oublié côté trigger → trajet de remboursement non rendu. Ce test transforme
 * la vigilance humaine en échec de build : toute divergence casse la CI avant le
 * merge.
 *
 * Le trigger inclut LÉGITIMEMENT `brouillon` en plus (un brouillon ne consomme
 * pas de trajet) → la cible attendue = RIDE_CANCELLED_STATUSES ∪ {'brouillon'}.
 */

/** Remonte de l'emplacement du test jusqu'au dossier contenant supabase/migrations. */
function findMigrationsDir(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 10; depth++) {
    const candidate = join(dir, 'supabase', 'migrations');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Répertoire supabase/migrations introuvable depuis le test.');
}

/** Extrait les valeurs de l'array `cancelled constant text[] := array[...]`. */
function extractCancelledArray(sql: string): string[] | null {
  const m = sql.match(/cancelled\s+constant\s+text\[\]\s*:=\s*array\[([\s\S]*?)\]/i);
  if (!m) return null;
  const values = [...m[1]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!);
  return values.length > 0 ? values : null;
}

describe('alignement RIDE_CANCELLED_STATUSES ↔ trigger SQL prescription (DEC-176)', () => {
  it('le trigger SQL le plus récent = statuts annulés + brouillon (aucune divergence)', () => {
    const dir = findMigrationsDir();
    // Tri lexicographique = chronologique (horodatage en préfixe de nom).
    // CREATE OR REPLACE : la migration la PLUS RÉCENTE fait foi → parcours décroissant.
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()
      .reverse();

    let sqlArray: string[] | null = null;
    let sourceFile = '';
    for (const f of files) {
      const parsed = extractCancelledArray(readFileSync(join(dir, f), 'utf8'));
      if (parsed) {
        sqlArray = parsed;
        sourceFile = f;
        break;
      }
    }

    // Échec EXPLICITE si l'array est introuvable (un vert silencieux serait pire).
    expect(
      sqlArray,
      'Array `cancelled` introuvable dans les migrations — le trigger a changé de ' +
        'forme : mettre à jour cancelled-statuses-sync.test.ts.',
    ).not.toBeNull();

    const expected = new Set<string>([...RIDE_CANCELLED_STATUSES, 'brouillon']);
    const actual = new Set(sqlArray!);
    const missingInSql = [...expected].filter((s) => !actual.has(s));
    const extraInSql = [...actual].filter((s) => !expected.has(s));

    const hint =
      `Divergence trigger SQL (${sourceFile}) ↔ RIDE_CANCELLED_STATUSES. ` +
      `Manquant côté SQL: [${missingInSql.join(', ')}] ; en trop côté SQL: [${extraInSql.join(', ')}]. ` +
      'Tout statut d’annulation doit être présent AUX DEUX endroits (constante ' +
      '@tap/shared + array `cancelled` du trigger via une migration create or replace).';

    expect(missingInSql, hint).toEqual([]);
    expect(extraInSql, hint).toEqual([]);
  });
});
