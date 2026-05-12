/**
 * Helpers de formatage date FR centralisés (D-DTPICK-23 Phase 03.1.1).
 *
 * Toute formatation date/heure FR du projet PASSE par ici. Évite les usages
 * d'`Intl.DateTimeFormat` ad-hoc dispersés (NFR-002 ton cohérent).
 *
 * Locale : `fr` de `date-fns/locale`. Tree-shakeable au build (Vercel).
 * TZ : `Indian/Reunion` est la TZ navigateur cible (configurée dans
 * `vitest.config.ts` + `playwright.config.ts`). `date-fns` formate dans
 * la TZ courante du runtime, donc compatible sans tz manipulation.
 */
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/** Format jj/mm/aaaa — usage : DatePicker trigger, audit log timeline, drawer course. */
export function formatDateFr(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'dd/MM/yyyy', { locale: fr });
}

/** Format HH:mm 24h — usage : Select créneaux, audit log, listings. */
export function formatTimeFr(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return format(d, 'HH:mm', { locale: fr });
}

/** Format complet — usage : preview saisie, audit log, drawer course header. */
export function formatDateTimeFr(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  return format(d, "EEEE d MMMM 'à' HH:mm", { locale: fr });
}
