'use client';

/**
 * AcceptInviteForm — form RHF + zodResolver pour activer le compte chauffeur (C04).
 *
 * Validation Zod miroir `acceptInvitationSchema` (PLAN-3 §3.1, `@tap/shared`)
 *   - password ≥ 8 (NIST 2020+ longueur seule)
 *   - confirmPassword match (refine)
 *   - cguAccepted: z.literal(true) (DEC-027)
 *
 * Le serveur tranche : `acceptInvitationAction` redirige vers
 * `/conduite?activated=1` sur succès, le toast success est déclenché côté
 * /conduite via <ActivationToast> (FLAG #1 patché, voir §4.8bis).
 *
 * Pattern DEC-028 : Input/Label/Button shadcn directs, checkbox HTML natif
 * (pas de Checkbox shadcn dans le repo). Erreurs serveur → toast Sonner.
 */

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';

import { acceptInvitationSchema, type AcceptInvitationInput } from '@tap/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/form/field';
import { acceptInvitationAction } from '../actions';

export function AcceptInviteForm({ userEmail }: { userEmail: string }) {
  const form = useForm<AcceptInvitationInput>({
    resolver: zodResolver(acceptInvitationSchema),
    mode: 'onBlur',
    defaultValues: {
      password: '',
      confirmPassword: '',
      // RHF default false sur checkbox ; le serveur exige z.literal(true).
      cguAccepted: false as unknown as true,
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    const fd = new FormData();
    fd.set('password', data.password);
    fd.set('confirmPassword', data.confirmPassword);
    fd.set('cguAccepted', data.cguAccepted ? 'on' : '');
    const result = await acceptInvitationAction({}, fd);
    if (result?.error) toast.error(result.error);
    // Pas d'else : acceptInvitationAction redirect('/conduite?activated=1')
    // Toast success déclenché côté /conduite via ActivationToast (FLAG #1).
  });

  return (
    <form onSubmit={onSubmit} className="space-y-16" noValidate>
      <div className="space-y-8">
        <Label htmlFor="email">Adresse e-mail</Label>
        <Input id="email" value={userEmail} readOnly className="bg-muted/40 h-10" />
      </div>

      <Field
        id="password"
        label="Mot de passe"
        type="password"
        autoComplete="new-password"
        className="h-10"
        hint="8 caractères minimum."
        error={form.formState.errors.password?.message}
        maxLength={128}
        {...form.register('password')}
      />

      <Field
        id="confirmPassword"
        label="Confirmer le mot de passe"
        type="password"
        autoComplete="new-password"
        className="h-10"
        error={form.formState.errors.confirmPassword?.message}
        maxLength={128}
        {...form.register('confirmPassword')}
      />

      <div className="flex items-start gap-8">
        <input
          id="cguAccepted"
          type="checkbox"
          {...form.register('cguAccepted')}
          className="border-border focus-visible:ring-ring mt-4 h-4 w-4 rounded focus-visible:ring-2"
        />
        <Label htmlFor="cguAccepted" className="text-sm leading-[1.4]">
          J&apos;accepte les{' '}
          <Link href="/legal/cgu" target="_blank" className="underline underline-offset-4">
            conditions générales d&apos;utilisation
          </Link>
          .
        </Label>
      </div>
      {form.formState.errors.cguAccepted ? (
        <p role="alert" className="text-destructive text-sm">
          {form.formState.errors.cguAccepted.message}
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={form.formState.isSubmitting}
        aria-busy={form.formState.isSubmitting}
        className="h-12 w-full"
      >
        {form.formState.isSubmitting ? 'Activation en cours…' : 'Activer mon compte'}
      </Button>
    </form>
  );
}
