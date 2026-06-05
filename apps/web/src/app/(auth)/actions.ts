'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Déconnexion — termine la session Supabase et redirige vers /login.
 *
 * Pattern :
 *   signOut() côté serveur → invalidation de l'arbre RSC pour purger les
 *   données utilisateur du cache → redirect /login. La redirection retire
 *   aussi l'utilisateur du shell authentifié (guard getUser() dans le
 *   layout (app)/(driver)).
 */
export async function signOutAction(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
