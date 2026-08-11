'use client';

import { Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { COURSES_HIDEABLE_COLUMNS } from '@/lib/use-courses-columns.client';

/**
 * Menu « Colonnes » — affiche / masque les colonnes MASQUABLES de la liste
 * (les essentielles n'y figurent pas → toujours visibles). Chaque entrée est un
 * `menuitemcheckbox` (clavier + `aria-checked`), coché = colonne visible. Le menu
 * reste ouvert au toggle (sélection multiple) et se ferme par Échap / clic
 * extérieur (Radix, focus rendu au déclencheur).
 */
export function CoursesColumnsMenu({
  hidden,
  onToggle,
  onReset,
}: {
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onReset: () => void;
}): JSX.Element {
  const hiddenCount = COURSES_HIDEABLE_COLUMNS.filter((c) => hidden.has(c.key)).length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-4"
          aria-label="Colonnes affichées"
        >
          <Columns3 className="h-16 w-16" aria-hidden />
          <span className="hidden sm:inline">Colonnes</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px]">
        <DropdownMenuLabel>Colonnes affichées</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COURSES_HIDEABLE_COLUMNS.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.key}
            checked={!hidden.has(col.key)}
            onCheckedChange={() => onToggle(col.key)}
            // Garder le menu ouvert pour enchaîner les bascules.
            onSelect={(e) => e.preventDefault()}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
        {hiddenCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                onReset();
              }}
            >
              Tout afficher
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
