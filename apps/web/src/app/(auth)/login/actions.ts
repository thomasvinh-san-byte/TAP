'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide'),
  password: z.string().min(1, 'Mot de passe requis'),
  next: z.string().optional(),
});

export type SignInState = {
  error?: string;
};

/**
 * Authentification email/mot de passe.
 *
 * - Validation zod (email format, mot de passe requis)
 * - signInWithPassword côté serveur (jamais de mot de passe en mémoire client)
 * - Reformulation FR systématique des erreurs Supabase (CLAUDE.md § 5)
 * - Open redirect protection : `next` doit commencer par `/`, sinon fallback `/patients`
 */
export async function signInAction(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? 'Saisie invalide' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: 'Identifiants invalides ou compte inexistant.' };
  }

  const next = parsed.data.next;
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/patients';

  redirect(safeNext);
}
