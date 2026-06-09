'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * <Pagination> — pagination de liste partagée (Phase 06.53, DEC-132).
 *
 * Par PLAGE ("1–50 sur 128") + Précédent/Suivant (grisés en bord, jamais
 * cachés) + sélecteur lignes par page. RÈGLE : ne s'affiche QUE si
 * `total > pageSize` (sinon `null` — pas de barre sous une liste courte).
 *
 * Pagination par PAGE (offset = page * pageSize), pas « voir plus » cumulatif.
 * Indifférent au mode (client-side ou server-driven) : l'appelant pilote
 * `page`/`onPageChange` et fournit `total`. `nav` + `aria-label` (RGAA).
 */

export interface PaginationProps {
  /** Page courante, 0-based. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const SELECT_CLASS =
  'border-input bg-background ring-offset-background focus-visible:ring-ring h-10 rounded-md border px-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
}: PaginationProps): JSX.Element | null {
  // Seuil : aucune barre tant que tout tient sur une page.
  if (total <= pageSize) return null;

  const pageCount = Math.ceil(total / pageSize);
  const current = Math.min(page, pageCount - 1);
  const from = current * pageSize + 1;
  const to = Math.min((current + 1) * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-12 pt-12"
    >
      <p className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
        {from}–{to} sur {total}
      </p>

      <div className="flex items-center gap-12">
        {onPageSizeChange ? (
          <label className="text-muted-foreground flex items-center gap-8 text-sm">
            <span className="hidden sm:inline">Lignes par page</span>
            <select
              className={SELECT_CLASS}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Lignes par page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="flex items-center gap-8">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(current - 1)}
            disabled={current <= 0}
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-16 w-16" aria-hidden />
            <span className="ml-4 hidden sm:inline">Précédent</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(current + 1)}
            disabled={current >= pageCount - 1}
            aria-label="Page suivante"
          >
            <span className="mr-4 hidden sm:inline">Suivant</span>
            <ChevronRight className="h-16 w-16" aria-hidden />
          </Button>
        </div>
      </div>
    </nav>
  );
}
