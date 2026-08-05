'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateFieldFr } from '@/components/date-field-fr.client';
import type { ActionState } from '../actions';

type FormAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

interface Props {
  token: string;
  requestType: string;
  action: FormAction;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="accent" disabled={pending} className="h-48">
      {pending ? 'Vérification…' : 'Vérifier mon identité'}
    </Button>
  );
}

/**
 * Formulaire de vérification d'identité du portail patient (D-10).
 * Champs : NIR + nom + date de naissance. Tous les champs sont validés
 * côté serveur (zod) avant d'interroger la RPC `nir_match_patient_for_legal_request`.
 */
export function IdentityForm({ token, requestType, action }: Props) {
  const [state, formAction] = useFormState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className="max-w-[480px] space-y-24" noValidate>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="request_type" value={requestType} />

      <div className="space-y-8">
        <Label htmlFor="nir">Numéro de sécurité sociale (NIR)</Label>
        <Input
          id="nir"
          name="nir"
          inputMode="numeric"
          autoComplete="off"
          required
          aria-describedby="nir-help"
        />
        <p id="nir-help" className="text-muted-foreground text-sm">
          15 chiffres figurant sur votre carte vitale.
        </p>
      </div>

      <div className="space-y-8">
        <Label htmlFor="nom">Nom de famille</Label>
        <Input id="nom" name="nom" autoComplete="family-name" required />
      </div>

      <div className="space-y-8">
        <Label htmlFor="date_naissance">Date de naissance</Label>
        <DateFieldFr id="date_naissance" name="date_naissance" autoComplete="bday" required />
      </div>

      {state.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
