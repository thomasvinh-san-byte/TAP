import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * <ListToolbar> + <ListMeta> — barre d'outils de liste partagée (Phase 06.53,
 * DEC-132). Unifie l'alignement/espacement des toolbars (recherche/filtres/
 * actions) entre les 13 écrans sur data-table.
 *
 * CONTENANT paramétrable : chaque liste remplit les slots dont elle a besoin
 * (patients : `search` seul ; rides : `search` + `filters` + `actions`…). Les
 * VALEURS métier (filtres, libellés, défauts) restent définies par chaque
 * écran (DEC-132 D-06) — la toolbar ne porte que la structure.
 *
 * Slots :
 *   - `search`  : recherche, prend la largeur restante (`flex-1`, min 260px).
 *   - `filters` : selects/date métier (alignés, hauteur 38-40px).
 *   - `clear`   : lien « Effacer » discret (si filtres actifs).
 *   - `actions` : Exporter, etc., poussés à droite.
 * Le compteur d'éléments va dans `<ListMeta>` SOUS la toolbar (pas dedans).
 */

export interface ListToolbarProps {
  search?: ReactNode;
  filters?: ReactNode;
  clear?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function ListToolbar({
  search,
  filters,
  clear,
  actions,
  className,
}: ListToolbarProps): JSX.Element {
  return (
    <div className={cn('flex flex-wrap items-center gap-12', className)}>
      {search ? <div className="min-w-[260px] flex-1">{search}</div> : null}
      {filters}
      {clear}
      {actions ? <div className="ml-auto flex items-center gap-8">{actions}</div> : null}
    </div>
  );
}

/** Compteur d'éléments discret, en ligne meta sous la toolbar. */
export function ListMeta({ children }: { children: ReactNode }): JSX.Element {
  return <p className="text-muted-foreground text-sm tabular-nums">{children}</p>;
}
