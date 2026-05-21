'use client';

import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InitialsAvatar } from '@/components/ui/initials-avatar';
import { cn } from '@/lib/utils';
import { PatientSearch } from '../../patients/_components/patient-search.client';
import { searchPatientsAction } from '../../patients/actions';

/**
 * Sélecteur patient — pattern pill + clear (Stripe / Linear / Doctolib).
 *
 * Deux modes mutuellement exclusifs :
 *   - Mode recherche (selectedLabel vide) : input + liste filtrée.
 *     Aligné sur patients-list (liste défaut quand q vide, recherche à
 *     partir de 2 caractères).
 *   - Mode sélectionné (selectedLabel posé) : pill avec avatar + nom +
 *     bouton « Changer » qui réinitialise. La liste n'est plus visible
 *     tant que l'utilisateur n'a pas cliqué Changer.
 *
 * Le parent (RideExpressModal) contrôle l'état via les props :
 *   - onSelect(id, label)   : pose la sélection
 *   - onSelect('', '')      : réinitialise (utilisé par « Changer »)
 *   - error                 : message à afficher sous le composant
 */
interface Props {
  selectedLabel: string;
  onSelect: (id: string, label: string) => void;
  error?: string | null;
}

export function PatientPickerField({ selectedLabel, onSelect, error }: Props): JSX.Element {
  const [query, setQuery] = useState<string>('');
  const dq = useDeferredValue(query);

  const results = useQuery({
    queryKey: ['ride-modal-patients', dq],
    queryFn: () => searchPatientsAction(dq),
    enabled: !selectedLabel && (dq.length === 0 || dq.length >= 2),
    staleTime: 5_000,
  });

  // Mode sélectionné : pill cliquable
  if (selectedLabel) {
    return (
      <div className="space-y-8">
        <Label>Patient</Label>
        <div
          className={cn(
            'border-input bg-muted/30 flex items-center justify-between gap-12 rounded-md border px-12 py-12',
            error && 'border-destructive',
          )}
        >
          <div className="flex min-w-0 items-center gap-12">
            <InitialsAvatar name={selectedLabel} size={32} />
            <span className="truncate font-medium">{selectedLabel}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelect('', '');
              setQuery('');
            }}
            aria-label="Changer de patient"
            className="shrink-0 gap-8"
          >
            <X className="h-12 w-12" aria-hidden />
            Changer
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

  // Mode recherche : input + liste filtrée
  return (
    <div className="space-y-8">
      <Label htmlFor="patient">Patient</Label>
      <PatientSearch value={query} onChange={setQuery} />

      {dq.length === 1 && (
        <p className="text-muted-foreground text-xs">
          Tapez au moins 2 caractères pour rechercher.
        </p>
      )}

      {results.data && results.data.length > 0 && (
        <ul
          className="divide-border border-border max-h-[200px] divide-y overflow-y-auto rounded-md border"
          aria-label="Résultats de recherche"
        >
          {results.data.slice(0, 10).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p.id, `${p.prenom} ${p.nom}`)}
                className="hover:bg-muted focus-visible:ring-ring flex w-full items-center justify-between gap-12 px-12 py-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
              >
                <div className="flex min-w-0 items-center gap-12">
                  <InitialsAvatar name={`${p.prenom} ${p.nom}`} size={24} />
                  <span className="truncate font-medium">
                    {p.nom} {p.prenom}
                  </span>
                </div>
                {p.telephone && (
                  <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {p.telephone}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {dq.length >= 2 && !results.isPending && results.data && results.data.length === 0 && (
        <p className="text-muted-foreground text-xs">Aucun patient ne correspond à « {dq} ».</p>
      )}

      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
