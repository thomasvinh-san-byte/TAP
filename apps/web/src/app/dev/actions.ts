'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

/**
 * Server Action /dev — switch de session démo (Phase 3 / 03-G).
 *
 * Pattern miroir `(auth)/login/actions.ts` (CLAUDE.md § 10) :
 *   useFormState → safeParse zod → signOut + signInWithPassword Supabase →
 *   reformulation FR des erreurs → revalidatePath('/', 'layout') + redirect.
 *
 * Flag d'environnement : `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` (déjà posé sur
 * preview et production démo Phase 0.7). Si absent, la Server Action refuse
 * tout — alignement avec la page /dev qui renvoie un 404 dans ce cas.
 */

const switchSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
  redirectTo: z.string().startsWith('/'),
});

export type SwitchState = { error?: string };

export async function loginAsDemoAction(
  _prev: SwitchState,
  formData: FormData,
): Promise<SwitchState> {
  if (process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS !== 'true') {
    return { error: 'Mode démo désactivé.' };
  }

  const parsed = switchSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    redirectTo: formData.get('redirectTo'),
  });
  if (!parsed.success) return { error: 'Données démo invalides.' };

  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: 'Connexion démo impossible.' };

  revalidatePath('/', 'layout');
  redirect(parsed.data.redirectTo);
}
