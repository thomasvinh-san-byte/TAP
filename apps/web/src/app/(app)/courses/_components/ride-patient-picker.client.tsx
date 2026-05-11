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
 *
 * Comportement liste (Phase 3 / 03-G — aligné patients-list.client.tsx) :
 *   - q vide → 20 patients par défaut (queries.ts ligne 62-70), 10 affichés.
 *   - q == 1 char → hint « tapez au moins 2 caractères ».
 *   - q >= 2 → fuzzy ILIKE + word_similarity (migration 03-search-ilike).
 *
 * Erreur de validation (03-G) : l'erreur est affichée AU-DESSUS du picker
 * en `<p role="alert">`. On n'injecte pas de style destructive sur le
 * PatientSearch lui-même pour ne pas le toucher (composant partagé avec
 * la page /patients).
 */
export function PatientPickerField({
  selectedLabel,
  onSelect,
  error,
}: {
  selectedLabel: string;
  onSelect: (id: string, label: string) => void;
  error?: string | null;
}): JSX.Element {
  const [query, setQuery] = useState<string>('');
  const dq = useDeferredValue(query);
  const results = useQuery({
    queryKey: ['ride-modal-patients', dq],
    queryFn: () => searchPatientsAction(dq),
    enabled: dq.length === 0 || dq.length >= 2,
    placeholderData: (prev) => prev,
    staleTime: 5_000,
  });

  return (
    <div className="space-y-8">
      <Label htmlFor="patient">Patient</Label>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <PatientSearch value={query} onChange={setQuery} />
      {selectedLabel && (
        <p className="text-xs text-muted-foreground">
          Sélectionné : <span className="font-medium">{selectedLabel}</span>
        </p>
      )}
      {dq.length === 1 && (
        <p className="text-xs text-muted-foreground">
          Tapez au moins 2 caractères pour rechercher.
        </p>
      )}
      {((dq.length === 0 && results.data && results.data.length > 0) ||
        (dq.length >= 2 && results.data && results.data.length > 0)) && (
        <ul
          className="max-h-[240px] overflow-y-auto divide-y divide-border rounded-md border"
          aria-label="Résultats de recherche"
        >
          {results.data.slice(0, 10).map((p) => (
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
