'use client';

import { Label } from '@/components/ui/label';

// Select natif aligné sur le gabarit `<Input>` (h-10), soumet via `name`.
const NATIVE_SELECT_CLASS =
  'border-input bg-background ring-offset-background focus-visible:ring-ring h-10 w-full rounded-md border px-12 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

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
    <div className="space-y-8">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={id} required className={NATIVE_SELECT_CLASS}>
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
