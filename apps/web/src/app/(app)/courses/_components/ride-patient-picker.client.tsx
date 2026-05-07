'use client';

import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { PatientSearch } from '../../patients/_components/patient-search.client';
import { searchPatientsAction } from '../../patients/actions';

/**
 * Sous-composant du modal saisie express : sélecteur patient.
 * Réutilise PatientSearch Phase 1 (input stylé) + searchPatientsAction
 * (fuzzy 2 chars, pattern Phase 1 patients-list.client). Une fois sélectionné,
 * le patient est confirmé visuellement et le champ recherche est vidé.
 */
export function PatientPickerField({
  selectedLabel,
  onSelect,
}: {
  selectedLabel: string;
  onSelect: (id: string, label: string) => void;
}): JSX.Element {
  const [query, setQuery] = useState<string>('');
  const dq = useDeferredValue(query);
  const results = useQuery({
    queryKey: ['ride-modal-patients', dq],
    queryFn: () => searchPatientsAction(dq),
    enabled: dq.length >= 2,
    staleTime: 5_000,
  });

  return (
    <div className="space-y-8">
      <Label htmlFor="patient">Patient</Label>
      <PatientSearch value={query} onChange={setQuery} />
      {selectedLabel && (
        <p className="text-xs text-muted-foreground">
          Sélectionné : <span className="font-medium">{selectedLabel}</span>
        </p>
      )}
      {dq.length >= 2 && results.data && results.data.length > 0 && (
        <ul
          className="max-h-[160px] overflow-y-auto divide-y divide-border rounded-md border"
          aria-label="Résultats de recherche"
        >
          {results.data.slice(0, 6).map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  onSelect(p.id, `${p.prenom} ${p.nom}`);
                  setQuery('');
                }}
                className="flex w-full items-center justify-between px-12 py-8 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-medium">
                  {p.nom} {p.prenom}
                </span>
                {p.telephone && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {p.telephone}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
