'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DpaPrefillFiche } from '../../_lib/dpa-prefill-content';

/**
 * Une carte de l'écran de revue du pré-remplissage DPA (Wave 3).
 *
 * `signed_at` et `dpa_version` sont vides et obligatoires : le dirigeant les
 * saisit lui-même (D-04 — TAP décrit la fiche, ne valide pas le contrat).
 */

interface DpaPrefillCardProps {
  fiche: DpaPrefillFiche;
  index: number;
  included: boolean;
  error?: string;
  onIncludedChange: (included: boolean) => void;
}

export function DpaPrefillCard({
  fiche,
  index,
  included,
  error,
  onIncludedChange,
}: DpaPrefillCardProps): JSX.Element {
  const checkboxId = `dpa-prefill-include-${index}`;
  const fieldId = (name: string) => `dpa-prefill-${index}-${name}`;

  return (
    <div data-testid="dpa-prefill-card" className="rounded-lg border p-16">
      <div className="flex items-center gap-8">
        <input
          type="checkbox"
          id={checkboxId}
          data-testid={checkboxId}
          checked={included}
          onChange={(e) => onIncludedChange(e.target.checked)}
        />
        <label htmlFor={checkboxId} className="text-sm font-semibold">
          {fiche.subprocessor_name}
        </label>
      </div>

      <form
        id={`dpa-prefill-form-${index}`}
        onSubmit={(e) => e.preventDefault()}
        className={included ? 'mt-16 space-y-16' : 'hidden'}
      >
        <div className="space-y-4">
          <Label htmlFor={fieldId('subprocessor_name')}>Sous-traitant</Label>
          <Input
            id={fieldId('subprocessor_name')}
            name="subprocessor_name"
            required
            defaultValue={fiche.subprocessor_name}
          />
        </div>
        <div className="space-y-4">
          <Label htmlFor={fieldId('subprocessor_role')}>Rôle</Label>
          <Input
            id={fieldId('subprocessor_role')}
            name="subprocessor_role"
            required
            defaultValue={fiche.subprocessor_role}
          />
        </div>
        <div className="space-y-4">
          <Label htmlFor={fieldId('dpa_version')}>Version du DPA</Label>
          <Input id={fieldId('dpa_version')} name="dpa_version" defaultValue={fiche.dpa_version} />
          <p className="text-muted-foreground text-xs">Obligatoire — à renseigner.</p>
        </div>
        <div className="space-y-4">
          <Label htmlFor={fieldId('signed_at')}>Date de signature</Label>
          <Input
            id={fieldId('signed_at')}
            name="signed_at"
            type="date"
            lang="fr-FR"
            defaultValue={fiche.signed_at}
          />
          <p className="text-muted-foreground text-xs">
            Obligatoire — à renseigner. TAP décrit la fiche, vous validez le contrat.
          </p>
        </div>
        <div className="space-y-4">
          <Label htmlFor={fieldId('notes')}>Notes</Label>
          <textarea
            id={fieldId('notes')}
            name="notes"
            rows={3}
            defaultValue={fiche.notes}
            className="border-input bg-background flex w-full rounded-md border px-12 py-8 text-sm"
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </form>
    </div>
  );
}
