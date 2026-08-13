import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { KpiState } from './kpi-card';

/**
 * Constantes et helpers de PRÉSENTATION partagés par les composants de tier du
 * tableau de bord (Phase 06.8). Extrait de `page.tsx` (refactor structurel) —
 * aucun changement de comportement : mêmes classes, mêmes formats, mêmes seuils.
 * Aucune logique de calcul métier ici (celle-ci reste dans `_lib/*-kpis.ts`).
 */

// Titre de tier (zone majeure) et libellé de sous-groupe (discret) — hiérarchie
// visuelle : un `h2` par tier, des libellés non-titres pour les sous-groupes
// (l'ossature de titres reste h1 → h2 tiers → h3 cartes).
export const TIER_TITLE_CLASS = 'text-foreground text-sm font-semibold uppercase tracking-wide';
export const GROUP_LABEL_CLASS =
  'text-muted-foreground text-xs font-semibold uppercase tracking-wide';

export const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
// Lot 5.20-B — distances estimées à 1 décimale (chiffres tabulaires côté carte).
export const km1 = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
// Lot 5.20-E — coût/km à 2-3 décimales (le €/km est fin).
export const km2 = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 3,
});

export const METHOD_LABELS: Record<string, string> = {
  cash: 'Espèces',
  cb: 'CB',
  cheque: 'Chèque',
  cgss_differe: 'CGSS différé',
  inconnu: 'Non précisé',
};

/** Libellé de délai signé : retard (+), avance (−) ou à l'heure. */
export function delaiLabel(min: number): string {
  if (min === 0) return "à l'heure";
  if (min > 0) return `+${min} min`;
  return `${min} min`;
}

export function plural(n: number, sing: string, plur: string): string {
  return `${n} ${n > 1 ? plur : sing}`;
}

/** `YYYY-MM` → libellé fr « mai 2026 ». */
export function moisEnClair(mois: string): string {
  return format(new Date(`${mois}-01T00:00:00`), 'MMMM yyyy', { locale: fr });
}

/** Mois précédent au format `YYYY-MM` (wrap année correct). */
export function previousMonthOf(ym: string): string {
  const [yearStr, monthStr] = ym.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

export function tauxState(taux: number): { state: KpiState; label: string } {
  if (taux > 15) return { state: 'alerte', label: 'au-dessus du seuil de 10 %' };
  if (taux >= 10) return { state: 'attention', label: 'proche du seuil de 10 %' };
  return { state: 'succes', label: 'sous le seuil de 10 %' };
}

// KPI-02 — seuils d'encours impayé (€). Pas de référence métier universelle pour
// le transport sanitaire 974 → valeurs nommées À VALIDER avec le dirigeant
// (plutôt qu'un chiffre magique enfoui). Le calibrage se fera à l'usage.
export const ENCOURS_ATTENTION_EUR = 500;
export const ENCOURS_ALERTE_EUR = 1500;

export function encoursState(total: number): { state: KpiState; label: string } {
  if (total >= ENCOURS_ALERTE_EUR) {
    return { state: 'alerte', label: `au-dessus de ${ENCOURS_ALERTE_EUR} €` };
  }
  if (total >= ENCOURS_ATTENTION_EUR) {
    return { state: 'attention', label: `au-dessus de ${ENCOURS_ATTENTION_EUR} €` };
  }
  return { state: 'succes', label: 'sous le seuil de vigilance' };
}
