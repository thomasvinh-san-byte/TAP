'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { FormColumns, FormColumn, FormActions } from '@/components/form/form-layout';
import { PatientFormNote } from './patient-form-note.client';
import {
  CoordinatesSection,
  IdentitySection,
  PreferencesSection,
  ReferentLegalSection,
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
    <Button type="submit" disabled={pending} className="h-10">
      {pending ? 'Enregistrement…' : children}
    </Button>
  );
}

/**
 * Formulaire patient réutilisable (PAT-01) — création + édition.
 *
 * Layout 2 colonnes « tout visible » (Phase 06.51, DEC-130) via le patron de
 * form partagé : GAUCHE Identité + Préférences ; DROITE Coordonnées + Note.
 * 1 colonne < lg. Chaque section se lit ligne par ligne (anti-saut Baymard).
 * Barre d'action en bas (Annuler + soumission). `react-dom` `useFormState`
 * (Server Actions natives). Validation zod côté serveur (actions.ts) —
 * INCHANGÉE. Labels exacts pour le test E2E PLAN-1 (`getByLabel`).
 */
export function PatientForm({ action, defaultValues = {}, submitLabel }: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});
  const dv = defaultValues;
  return (
    <form action={formAction} className="mx-auto w-full max-w-[980px] space-y-24" noValidate>
      <FormColumns>
        <FormColumn>
          <IdentitySection dv={dv} />
          <PreferencesSection dv={dv} />
        </FormColumn>
        <FormColumn>
          <CoordinatesSection dv={dv} />
          <ReferentLegalSection dv={dv} />
          <PatientFormNote defaultValue={dv.notes_operationnelles} />
        </FormColumn>
      </FormColumns>

      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <FormActions>
        <Button asChild variant="outline" className="h-10">
          <Link href="/patients">Annuler</Link>
        </Button>
        <SubmitButton>{submitLabel}</SubmitButton>
      </FormActions>
    </form>
  );
}
