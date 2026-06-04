'use client';

/**
 * LoginForm — Migration RHF + zodResolver (C06, premier RHF productif du repo).
 *
 * Pattern DEC-028 : `<Input>` `<Label>` `<Button>` shadcn directs, PAS de
 * wrapper `<Form>` shadcn (réservé formulaires complexes futurs Phase 04.7).
 *
 * `signInAction` (actions.ts) INCHANGÉE — signature `(prev, formData)`
 * conservée. L'appel client transite par `FormData` reconstruit dans
 * `onSubmit` pour préserver le contrat serveur.
 *
 * Prefill via prop `prefill` (state up dans `<LoginFormShell>`) + `useEffect`
 * `setValue` sur mutation de `prefill`. Permet à `<DemoCredentials>` de
 * cliquer pour pré-remplir le form sans submit automatique.
 *
 * Erreurs serveur → toast Sonner (D-RHF-02). Erreurs Zod client → render
 * inline sous champ avec `role="alert"`.
 */

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/form/password-input.client';
import { signInAction } from './actions';

const signInSchema = z.object({
  email: z.string().email({ message: 'Adresse e-mail invalide.' }),
  password: z.string().min(1, { message: 'Mot de passe requis.' }),
});
type SignInInput = z.infer<typeof signInSchema>;

interface LoginFormProps {
  next?: string;
  prefill?: { email: string; password: string };
}

export function LoginForm({ next, prefill }: LoginFormProps) {
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    mode: 'onBlur',
    defaultValues: {
      email: prefill?.email ?? '',
      password: prefill?.password ?? '',
    },
  });

  // Sync prefill lorsque DemoCredentials est cliqué (state remonté dans
  // LoginFormShell). shouldValidate: false → on n'ouvre pas d'erreurs
  // d'emblée juste parce qu'on prefill.
  useEffect(() => {
    if (prefill) {
      form.setValue('email', prefill.email, { shouldValidate: false });
      form.setValue('password', prefill.password, { shouldValidate: false });
    }
  }, [prefill, form]);

  const onSubmit = form.handleSubmit(async (data) => {
    const fd = new FormData();
    fd.set('email', data.email);
    fd.set('password', data.password);
    if (next) fd.set('next', next);
    const result = await signInAction({}, fd);
    if (result?.error) toast.error(result.error);
    // Pas d'else : signInAction redirige côté serveur sur succès.
  });

  return (
    <form onSubmit={onSubmit} className="space-y-16" noValidate>
      <div className="space-y-8">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input
          id="email"
          type="email"
          // Phase 06.18 D-02 : inputMode email pour clavier mobile (@ et .).
          inputMode="email"
          autoComplete="username"
          className="h-10"
          {...form.register('email')}
          aria-invalid={!!form.formState.errors.email}
        />
        {form.formState.errors.email ? (
          <p role="alert" className="text-destructive text-sm">
            {form.formState.errors.email.message}
          </p>
        ) : null}
      </div>

      <div className="space-y-8">
        <Label htmlFor="password">Mot de passe</Label>
        {/* Phase 06.18 D-01 : toggle afficher/masquer (PasswordInput commun). */}
        <PasswordInput
          id="password"
          autoComplete="current-password"
          className="h-10"
          {...form.register('password')}
          aria-invalid={!!form.formState.errors.password}
        />
        {form.formState.errors.password ? (
          <p role="alert" className="text-destructive text-sm">
            {form.formState.errors.password.message}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        aria-busy={form.formState.isSubmitting}
        className="h-12 w-full text-base"
      >
        {form.formState.isSubmitting ? 'Connexion en cours…' : 'Se connecter'}
      </Button>
    </form>
  );
}
