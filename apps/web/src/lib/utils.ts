import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Concatène et déduplique les classes Tailwind (utilisé par tous les composants shadcn/ui).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Masque le NIR pour affichage par défaut (D-05).
 *
 * `nir_last4` est la valeur clair non secrète exposée par la vue
 * `patients_safe` (PLAN-2). Format DB : `"XX YY"` (2 derniers chiffres du
 * numéro + clé sur 2). On préfixe par `1` (sexe administratif typique +
 * pastille terracotta dans l'UI) puis 9 bullets, puis le couple last4.
 *
 * Si aucun NIR enregistré → bullets uniformes (5 groupes).
 */
export function maskNir(nirLast4: string | null | undefined): string {
  if (!nirLast4) return '••• ••• ••• ••• •••';
  return `1•••••••••${nirLast4}`;
}
