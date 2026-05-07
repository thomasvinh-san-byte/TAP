'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { PatientFormNote } from './patient-form-note.client';
import {
  CoordinatesSection,
  IdentitySection,
  PreferencesSection,
  type PatientFormDefaults,
} from './patient-form-sections.client';
import type { ActionState } from '../actions';

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

interface Props {
  action: FormAction;
  defaultValues?: PatientFormDefaults;
  submitLabel: string;
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="h-48">
      {pending ? 'Enregistrement…' : children}
    </Button>
  );
}

/**
 * Formulaire patient réutilisable (PAT-01) — création + édition.
 *
 * - `react-dom` `useFormState` : intégration native Server Actions.
 * - Sections extraites en sous-composants pour rester ≤ 150 lignes
 *   (CLAUDE.md § 11). Validation zod côté serveur (actions.ts).
 * - Labels exacts pour le test E2E PLAN-1 (`getByLabel`).
 */
export function PatientForm({
  action,
  defaultValues = {},
  submitLabel,
}: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});
  const dv = defaultValues;
  return (
    <form action={formAction} className="max-w-[640px] space-y-24" noValidate>
      <IdentitySection dv={dv} />
      <CoordinatesSection dv={dv} />
      <PreferencesSection dv={dv} />
      <PatientFormNote defaultValue={dv.notes_operationnelles} />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
