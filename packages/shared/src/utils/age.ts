/**
 * Calcul d'âge et statut mineur (DEC-172, T3).
 *
 * Le statut « mineur » est DÉRIVÉ de la date de naissance — JAMAIS stocké en
 * base (source unique). Fonction PURE, testable. `now` injectable pour les
 * tests (par défaut : maintenant).
 */

const MAJORITY_AGE = 18;

/** Âge en années révolues à la date `now` (gère le jour anniversaire). */
export function ageInYears(dateNaissance: string, now: Date = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateNaissance);
  if (!m) return null;
  const year = Number.parseInt(m[1]!, 10);
  const month = Number.parseInt(m[2]!, 10);
  const day = Number.parseInt(m[3]!, 10);
  let age = now.getFullYear() - year;
  // Pas encore l'anniversaire cette année → retirer 1.
  const beforeBirthday =
    now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age;
}

/** Vrai si le patient a moins de 18 ans à la date `now` (mineur). */
export function isMinor(dateNaissance: string, now: Date = new Date()): boolean {
  const age = ageInYears(dateNaissance, now);
  if (age === null) return false;
  return age < MAJORITY_AGE;
}
