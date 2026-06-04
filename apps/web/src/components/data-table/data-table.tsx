'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * <DataTable> — composant data table sémantique (Phase 06.15 D-01).
 *
 * Uniformise les 13 data tables sur une structure HTML `<table>` + densité
 * DEC-034 (header `bg-muted/40`, padding 12, séparateurs `divide-border`,
 * hover `bg-muted/50`, 64-72 px/ligne). Consomme les tokens 06.14 via
 * classes sémantiques. Aucun hex en dur (NFR-001).
 *
 * Tri par URL (D-03 affinée) : le pattern caisse-table est généralisé via
 * la prop `sort.hrefFor` — le header triable rend un `<Link>` deep-link
 * server-driven. Le callback `onSortChange` est supporté pour les tables
 * 100 % client futures, mais non utilisé en V1.
 *
 * A11y RGAA (D-05) : `<th scope="col">`, `aria-sort`, focus visible via
 * `--ring`, `prefers-reduced-motion` hérité de globals.css.
 *
 * Logique métier des tables consommatrices PRÉSERVÉE (D-04) — seule la
 * présentation tabulaire est extraite ici. Les actions, dialogues, Server
 * Actions, formulaires restent dans le composant appelant et sont passés
 * via les renderers `cell`.
 */

export interface DataTableColumn<T> {
  /** Identifiant unique de colonne (utilisé pour aria-sort, sort.column). */
  key: string;
  /** Titre de colonne (texte ou nœud — ex : icône + texte). */
  header: React.ReactNode;
  /** Renderer de cellule. Reçoit la ligne et l'index. */
  cell: (row: T, index: number) => React.ReactNode;
  /** Si vrai, le header est cliquable et émet sort (URL ou callback). */
  sortable?: boolean;
  /** Largeur (ex : `'140px'`, `'15%'`). Applique aussi au `<th>`. */
  width?: string;
  /** Alignement horizontal du contenu. */
  align?: 'left' | 'right' | 'center';
  /** Classe Tailwind additionnelle sur le `<th>`. */
  headerClassName?: string;
  /** Classe Tailwind additionnelle sur les `<td>` de la colonne. */
  cellClassName?: string;
}

export interface DataTableSort {
  /** Colonne actuellement triée (`key` d'une colonne `sortable: true`). */
  column: string;
  /** Direction courante. */
  dir: 'asc' | 'desc';
  /**
   * Génère l'URL de bascule du tri (pattern caisse — server-driven,
   * deep-link). Si fourni, le header triable rend un `<Link>` ; sinon
   * un `<button>` qui appelle `onSortChange`.
   */
  hrefFor?: (column: string, nextDir: 'asc' | 'desc') => string;
  /**
   * Callback de tri 100 % client (pour les tables qui n'ont pas besoin
   * du deep-link). Mutuellement exclusif avec `hrefFor` côté usage.
   */
  onSortChange?: (column: string, dir: 'asc' | 'desc') => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  /** Clé React stable par ligne. DEC-033 : inclure le champ mutable si requis. */
  rowKey: (row: T) => string;
  /** `aria-label` du `<table>` — décrit le contenu pour les lecteurs d'écran. */
  ariaLabel: string;
  /** État de tri (V1 — caisse-table seule l'utilise). */
  sort?: DataTableSort;
  /** Si vrai, affiche un skeleton miroir (5 lignes par défaut). */
  loading?: boolean;
  /** Nombre de lignes du skeleton (défaut 5). */
  loadingRows?: number;
  /**
   * État vide : passer un nœud rendu par l'appelant (ex : `<EmptyState … />`).
   * Si absent, affiche un message minimal en cellule unique.
   */
  emptyState?: React.ReactNode;
  /** Pied de tableau optionnel — utilisé par caisse-table pour `Total`. */
  footer?: React.ReactNode;
  /** Classe additionnelle sur le conteneur `<div>` enveloppant la `<table>`. */
  className?: string;
  /**
   * Classe additionnelle calculée par ligne (ex : animation fade-in sur
   * nouvelles courses cockpit). Reçoit la ligne et l'index. Concaténé au
   * `hover:bg-muted/40 transition-colors` par défaut.
   */
  rowClassName?: (row: T, index: number) => string;
  /**
   * Handler de clic sur la ligne entière (ex : ouvre un drawer rides-list).
   * Si défini : la ligne reçoit `cursor-pointer` et un `onClick`. Les
   * boutons d'action dans les cellules doivent appeler `e.stopPropagation()`
   * pour éviter le déclenchement.
   */
  onRowClick?: (row: T, index: number) => void;
}

const ALIGN_CLASS: Record<NonNullable<DataTableColumn<unknown>['align']>, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

function SortableHeader<T>({
  column,
  sort,
}: {
  column: DataTableColumn<T>;
  sort: DataTableSort;
}): React.ReactNode {
  const isActive = sort.column === column.key;
  const nextDir: 'asc' | 'desc' = isActive && sort.dir === 'desc' ? 'asc' : 'desc';
  const Icon = isActive ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
  const linkClass =
    'hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-4 rounded-sm focus-visible:outline-none focus-visible:ring-2';

  if (sort.hrefFor) {
    return (
      <Link href={sort.hrefFor(column.key, nextDir)} scroll={false} className={linkClass}>
        {column.header}
        <Icon className="h-12 w-12" aria-hidden />
      </Link>
    );
  }
  if (sort.onSortChange) {
    return (
      <button
        type="button"
        onClick={() => sort.onSortChange?.(column.key, nextDir)}
        className={linkClass}
      >
        {column.header}
        <Icon className="h-12 w-12" aria-hidden />
      </button>
    );
  }
  return <>{column.header}</>;
}

function ariaSortValue<T>(
  column: DataTableColumn<T>,
  sort: DataTableSort | undefined,
): 'ascending' | 'descending' | 'none' | undefined {
  if (!column.sortable || !sort) return undefined;
  if (sort.column !== column.key) return 'none';
  return sort.dir === 'asc' ? 'ascending' : 'descending';
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  ariaLabel,
  sort,
  loading,
  loadingRows = 5,
  emptyState,
  footer,
  className,
  rowClassName,
  onRowClick,
}: DataTableProps<T>): JSX.Element {
  if (!loading && rows.length === 0 && emptyState !== undefined) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn('border-border overflow-hidden rounded-md border', className)}>
      <table className="divide-border w-full divide-y" aria-label={ariaLabel}>
        <thead className="bg-muted/40">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                aria-sort={ariaSortValue(col, sort)}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  'text-muted-foreground px-12 py-8 text-xs font-medium uppercase tracking-wide',
                  ALIGN_CLASS[col.align ?? 'left'],
                  col.headerClassName,
                )}
              >
                {col.sortable && sort ? <SortableHeader column={col} sort={sort} /> : col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-border bg-background divide-y">
          {loading ? (
            Array.from({ length: loadingRows }).map((_, i) => (
              <tr key={`skeleton-${i}`}>
                {columns.map((col) => (
                  <td key={col.key} className="px-12 py-12">
                    <Skeleton className="h-16 w-full" />
                  </td>
                ))}
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="text-muted-foreground px-12 py-24 text-center text-sm"
              >
                Aucun résultat à afficher.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={rowKey(row)}
                className={cn(
                  'hover:bg-muted/40 transition-colors',
                  onRowClick && 'cursor-pointer',
                  rowClassName?.(row, index),
                )}
                onClick={onRowClick ? () => onRowClick(row, index) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-12 py-12 text-sm',
                      ALIGN_CLASS[col.align ?? 'left'],
                      col.cellClassName,
                    )}
                  >
                    {col.cell(row, index)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer ? <tfoot className="bg-muted/40">{footer}</tfoot> : null}
      </table>
    </div>
  );
}
