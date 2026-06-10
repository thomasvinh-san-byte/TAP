'use client';

import {
  RegistreFields,
  type RegistreFieldsValues,
} from '../../_components/registre-fields.client';
import { Checkbox } from '@/components/ui/checkbox';
import type { DataProcessingRegisterInput } from '@tap/shared';

/**
 * Une carte de l'écran de revue du pré-remplissage du registre (Wave 2).
 *
 * En-tête = case « inclure » + intitulé court. Corps = `RegistreFields`
 * pré-rempli avec l'entrée-type, éditable. Décochée → corps masqué (les
 * valeurs restent montées, donc préservées si on recoche).
 *
 * Le corps est un `<form>` dédié (`prefill-form-{index}`) — l'orchestrateur
 * lit sa `FormData` à l'insertion, uniquement pour les cartes cochées.
 */

interface RegistrePrefillCardProps {
  entry: DataProcessingRegisterInput;
  index: number;
  label: string;
  included: boolean;
  onIncludedChange: (included: boolean) => void;
}

function toFieldValues(entry: DataProcessingRegisterInput): Partial<RegistreFieldsValues> {
  return {
    purpose: entry.purpose,
    legal_basis: entry.legal_basis,
    data_categories: entry.data_categories.join(', '),
    data_subjects: entry.data_subjects.join(', '),
    recipients: entry.recipients.join(', '),
    retention_period_days: entry.retention_period_days,
    security_measures: entry.security_measures,
    international_transfer: entry.international_transfer,
  };
}

export function RegistrePrefillCard({
  entry,
  index,
  label,
  included,
  onIncludedChange,
}: RegistrePrefillCardProps): JSX.Element {
  const checkboxId = `prefill-include-${index}`;
  return (
    <div data-testid="prefill-card" className="rounded-lg border p-16">
      <div className="flex items-center gap-8">
        <Checkbox
          id={checkboxId}
          data-testid={checkboxId}
          checked={included}
          onChange={(e) => onIncludedChange(e.target.checked)}
        />
        <label htmlFor={checkboxId} className="text-sm font-semibold">
          {index + 1} · {label}
        </label>
      </div>
      <form
        id={`prefill-form-${index}`}
        onSubmit={(e) => e.preventDefault()}
        className={included ? 'mt-16' : 'hidden'}
      >
        <RegistreFields idPrefix={`prefill-${index}`} values={toFieldValues(entry)} />
      </form>
    </div>
  );
}
