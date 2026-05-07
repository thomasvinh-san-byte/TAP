import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Concatène et déduplique les classes Tailwind (utilisé par tous les composants shadcn/ui).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
