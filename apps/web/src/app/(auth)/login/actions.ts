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
export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  // FormData.get() retourne null pour un champ absent ou vide (cas d'un hidden
  // input "next" non renseigné). zod .optional() n'accepte que undefined → on
  // coerce null → undefined avant le parse.
  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');
  const rawNext = formData.get('next');

  const parsed = signInSchema.safeParse({
    email: rawEmail ?? undefined,
    password: rawPassword ?? undefined,
    next: rawNext ?? undefined,
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

  // Open redirect protection : `next` doit commencer par `/`, pas par `//`.
  const next = parsed.data.next;
  if (next && next.startsWith('/') && !next.startsWith('//')) {
    redirect(next);
  }

  // DEC-054 + DEC-071 — redirect role-aware : dirigeant → /tableau-de-bord,
  // régulateur → /cockpit, chauffeur → /conduite, fallback /patients.
  // DEC-071 amende la clause incidente de DEC-054 (le dirigeant n'atterrit
  // plus sur /cockpit mais sur son tableau de bord) ; le cœur de DEC-054
  // (régulateur → /cockpit) est préservé.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const profileRes = await supabase.from('profiles').select('role').eq('id', user.id).single();
    const profile = profileRes.data as { role: string | null } | null;
    if (profile?.role === 'dirigeant') {
      redirect('/tableau-de-bord');
    }
    if (profile?.role === 'regulateur') {
      redirect('/cockpit');
    }
    if (profile?.role === 'chauffeur') {
      redirect('/conduite');
    }
  }

  redirect('/patients');
}
