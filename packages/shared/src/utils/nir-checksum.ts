/**
 * Algorithme INSEE clé de contrôle NIR (numéro de sécurité sociale FR).
 *
 * Spec INSEE :
 *   - NIR = 13 chiffres (sexe + année + mois + département + commune + ordre)
 *     suivis de 2 chiffres de clé.
 *   - Pour la Corse, les positions 6-7 (département) peuvent être '2A' ou
 *     '2B'. Avant le calcul, '2A' → '19' et '2B' → '18'.
 *   - Clé attendue = 97 - (N mod 97), où N = entier des 13 premiers chiffres
 *     traités.
 *
 * RGPD (data santé) : ce module ne logge JAMAIS l'entrée. Retourne false
 * silencieusement pour toute entrée invalide structurelle. Pas de throw.
 *
 * Refs : PLAN-2 Task 2.1, D-04, DEC-036, threat T-04.5-05.
 */

const CORSE_REPLACEMENTS: Readonly<Record<string, string>> = {
  '2A': '19',
  '2B': '18',
};

/**
 * Convertit le département Corse '2A'/'2B' en pseudo-chiffres pour calcul.
 * Renvoie la chaîne canonique 13 chiffres prête à parser, ou null si la
 * structure est invalide.
 */
function toCanonicalDigits13(nir15: string): string | null {
  if (typeof nir15 !== 'string') return null;
  const trimmed = nir15.replace(/\s+/g, '').toUpperCase();
  if (trimmed.length !== 15) return null;

  const head13 = trimmed.slice(0, 13);
  const dept = head13.slice(5, 7);

  // Cas standard : 13 chiffres
  if (/^[0-9]{13}$/.test(head13)) return head13;

  // Cas Corse : positions 6-7 = '2A' ou '2B', le reste tout chiffres
  if (dept in CORSE_REPLACEMENTS) {
    const replaced =
      head13.slice(0, 5) +
      CORSE_REPLACEMENTS[dept] +
      head13.slice(7);
    if (/^[0-9]{13}$/.test(replaced)) return replaced;
  }

  return null;
}

/**
 * Calcule la clé de contrôle attendue (2 chiffres, 0-97) pour un NIR.
 *
 * Renvoie -1 pour une entrée invalide structurelle (au lieu de throw —
 * cf. RGPD jamais throw avec l'entrée en stack).
 */
export function computeNirChecksum(nir15: string): number {
  const canonical = toCanonicalDigits13(nir15);
  if (canonical === null) return -1;
  // BigInt évite tout overflow 53-bit sur 13 chiffres (max ~9.99e12 — OK
  // pour Number, mais BigInt est plus défensif pour la rétrocompatibilité).
  const n = BigInt(canonical);
  const key = 97n - (n % 97n);
  return Number(key);
}

/**
 * Vérifie qu'un NIR 15 chiffres (ou 13 + Corse 2A/2B + 2 clé) a une clé
 * correcte selon l'algorithme INSEE.
 *
 * Pas de log de l'entrée. Retourne false pour toute entrée invalide
 * structurelle (jamais throw).
 */
export function isNirChecksumValid(nir15: string): boolean {
  if (typeof nir15 !== 'string') return false;
  const trimmed = nir15.replace(/\s+/g, '').toUpperCase();
  if (trimmed.length !== 15) return false;
  const keyChars = trimmed.slice(13, 15);
  if (!/^[0-9]{2}$/.test(keyChars)) return false;
  const expectedKey = computeNirChecksum(trimmed);
  if (expectedKey < 0) return false;
  const providedKey = Number.parseInt(keyChars, 10);
  return providedKey === expectedKey;
}
