'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Switch de session démo (Phase 3 / 03-G).
 *
 * Outils de développement : permet de basculer rapidement entre les 3 comptes
 * démo (dirigeant / régulateur / chauffeur) sans repasser par /login. Garde
 * env identique à la page d'appel — la Server Action n'est jamais exposée en
 * production commerciale.
 *
 * Pattern Supabase officiel (cf. supabase.com/docs/guides/auth/server-side/nextjs) :
 *   signOut → signInWithPassword → revalidatePath layout → redirect.
 */
export async function loginAsDemoAction(formData: FormData): Promise<void> {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.NEXT_PUBLIC_DEMO_MODE !== 'true'
  ) {
    redirect('/login');
  }

  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const redirectTo = String(formData.get('redirectTo') ?? '/patients');

  const supabase = createClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect('/dev?error=' + encodeURIComponent(error.message));
  }

  revalidatePath('/', 'layout');
  redirect(redirectTo);
}
