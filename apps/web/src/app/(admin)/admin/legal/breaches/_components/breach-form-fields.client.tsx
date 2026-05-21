'use client';

import { Label } from '@/components/ui/label';

export const SEVERITY_OPTS = [
  ['faible', 'Faible'],
  ['moyen', 'Moyen'],
  ['eleve', 'Élevé'],
  ['critique', 'Critique'],
] as const;

export const NATURE_OPTS = [
  ['confidentialite', 'Confidentialité'],
  ['integrite', 'Intégrité'],
  ['disponibilite', 'Disponibilité'],
] as const;

export function SelectField({
  id,
  label,
  options,
}: {
  id: string;
  label: string;
  options: ReadonlyArray<readonly [string, string]>;
}) {
  return (
    <div className="space-y-4">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={id}
        required
        className="border-input bg-background flex h-32 w-full rounded-md border px-12 text-sm"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

export function CheckboxField({ id, label }: { id: string; label: string }) {
  return (
    <div className="flex items-center gap-8">
      <input id={id} name={id} type="checkbox" />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}
