'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { signInAction, type SignInState } from './actions';

const initialState: SignInState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className="w-full h-12 text-base"
      aria-busy={pending}
    >
      {pending ? 'Connexion en cours…' : 'Se connecter'}
    </Button>
  );
}

/**
 * Formulaire de connexion.
 *
 * - useFormState pour récupérer l'erreur Server Action sans navigation
 * - useFormStatus pour l'état pending du bouton (feedback < 100 ms perçu)
 * - Bouton h-12 (48 px) conforme spacing system desktop (CLAUDE.md § 5)
 * - Pas de `react-hook-form` ici : le formulaire est trivial (2 champs) et
 *   `useFormState` + validation zod côté serveur suffisent. RHF sera
 *   pertinent pour le formulaire patient en PLAN-5 (15+ champs typés).
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState(signInAction, initialState);

  return (
    <form action={formAction} className="space-y-16" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <div className="space-y-8">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="prenom.nom@exemple.fr"
        />
      </div>

      <div className="space-y-8">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          aria-live="polite"
          className="text-sm text-destructive"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
