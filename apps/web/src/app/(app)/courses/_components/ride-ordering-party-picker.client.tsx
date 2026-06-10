'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { listActiveOrderingPartiesAction } from '../actions';

/**
 * Sélecteur donneur d'ordres B2B — OPTIONNEL (CdC §5.5, DEC-148).
 *
 * Pattern miroir du PatientPickerField (pill + clear), mais la source est le
 * référentiel des donneurs d'ordres actifs (≤ 100) chargé une fois et filtré
 * côté client (pas de recherche serveur nécessaire). Le champ est facultatif :
 * « Aucun » = transport prescrit individuel (cas nominal).
 *
 *   - onSelect(id, label) : pose la sélection
 *   - onSelect(null, '')  : réinitialise (« Aucun donneur d'ordres »)
 */
interface Props {
  selectedId: string | null;
  selectedLabel: string;
  onSelect: (id: string | null, label: string) => void;
  error?: string | null;
}

export function OrderingPartyPickerField({
  selectedId,
  selectedLabel,
  onSelect,
  error,
}: Props): JSX.Element {
  const [query, setQuery] = useState<string>('');

  const parties = useQuery({
    queryKey: ['ride-ordering-parties'],
    queryFn: () => listActiveOrderingPartiesAction(),
    staleTime: 30_000,
    enabled: !selectedId,
  });

  const filtered = useMemo(() => {
    const list = parties.data ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => p.raison_sociale.toLowerCase().includes(q));
  }, [parties.data, query]);

  // Mode sélectionné : pill cliquable
  if (selectedId) {
    return (
      <div className="space-y-8">
        <Label>Donneur d&apos;ordres</Label>
        <div
          className={cn(
            'border-input bg-muted/30 flex items-center justify-between gap-12 rounded-md border px-12 py-12',
            error && 'border-destructive',
          )}
        >
          <div className="flex min-w-0 items-center gap-12">
            <div className="bg-muted text-muted-foreground flex h-32 w-32 shrink-0 items-center justify-center rounded-md">
              <Building2 className="h-16 w-16" aria-hidden />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="truncate font-medium" tabIndex={0}>
                  {selectedLabel}
                </span>
              </TooltipTrigger>
              <TooltipContent>{selectedLabel}</TooltipContent>
            </Tooltip>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelect(null, '');
              setQuery('');
            }}
            aria-label="Retirer le donneur d'ordres"
            className="shrink-0 gap-8"
          >
            <X className="h-12 w-12" aria-hidden />
            Retirer
          </Button>
        </div>
        {error && (
          <p className="text-destructive text-xs" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Mode recherche : input + liste filtrée (facultatif)
  return (
    <div className="space-y-8">
      <Label htmlFor="ordering-party">Donneur d&apos;ordres</Label>
      <Input
        id="ordering-party"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un établissement (facultatif)"
        autoComplete="off"
      />
      <p className="text-muted-foreground text-xs">
        Facultatif. Laissez vide pour un transport prescrit individuel.
      </p>

      {filtered.length > 0 && (
        <ul
          className="divide-border border-border max-h-[180px] divide-y overflow-y-auto rounded-md border"
          aria-label="Donneurs d'ordres"
        >
          {filtered.slice(0, 10).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id, p.raison_sociale)}
                className="hover:bg-muted focus-visible:ring-ring flex w-full items-center gap-12 px-12 py-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
              >
                <div className="bg-muted text-muted-foreground flex h-24 w-24 shrink-0 items-center justify-center rounded-md">
                  <Building2 className="h-12 w-12" aria-hidden />
                </div>
                <span className="truncate font-medium">{p.raison_sociale}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {query.trim().length > 0 && filtered.length === 0 && !parties.isPending && (
        <p className="text-muted-foreground text-sm">
          Aucun donneur d&apos;ordres ne correspond à « {query.trim()} ».
        </p>
      )}

      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
